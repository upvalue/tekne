// One save request per document at a time. Acknowledgements cover only the
// captured generation; edits made in flight remain dirty for the next request.

export const SAVE_RETRY_MS = 5000

export type SaveResult<Doc> =
  | { status: 'ok'; revision: number }
  | { status: 'conflict'; serverDoc: Doc; serverRevision: number }

export type SaveConflict<Doc> = { serverDoc: Doc; serverRevision: number }

/** A flush failed because a revision conflict is waiting on the user. */
export class SaveConflictError extends Error {
  constructor() {
    super('Document has a revision conflict awaiting resolution')
  }
}

export class SaveQueueDisposedError extends Error {
  constructor() {
    super('Save queue was disposed with a flush pending')
  }
}

export type SaveQueueState<Doc> = {
  baseline: Doc
  snapshot: Doc
  revision: number
  generation: number
  ackedGeneration: number
  attempt: {
    snapshot: Doc
    generation: number
    revision: number
    requestId: string
  } | null
  conflict: SaveConflict<Doc> | null
}

type Waiter = {
  generation: number
  resolve: () => void
  reject: (error: unknown) => void
}

export class SaveQueue<Doc> {
  private generation = 0
  private ackedGeneration = 0
  private revision: number
  private inFlight = false
  private attempt: {
    snapshot: Doc
    generation: number
    revision: number
    requestId: string
  } | null = null
  private conflict: SaveConflict<Doc> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private waiters: Waiter[] = []
  private disposed = false
  private baseline: Doc
  private snapshot: Doc
  private persistence = Promise.resolve()

  constructor(
    private readonly opts: {
      revision: number
      paused?: boolean
      persist?: (state: SaveQueueState<Doc>) => Promise<void>
      onPersistenceError?: (error: unknown) => void
      getSnapshot: () => Doc
      performSave: (
        snapshot: Doc,
        expectedRevision: number,
        requestId: string,
        baseline: Doc
      ) => Promise<SaveResult<Doc>>
      /** The server acknowledged this snapshot at this revision. */
      onSaved: (snapshot: Doc, revision: number) => void
      /** A conditional write lost; autosave is paused until resolved. */
      onConflict: (conflict: SaveConflict<Doc>) => void
      onSaveError: (error: unknown) => void
    }
  ) {
    this.revision = opts.revision
    this.baseline = this.snapshot = opts.getSnapshot()
    this.disposed = opts.paused ?? false
  }

  isDirty(): boolean {
    return this.conflict !== null || this.generation > this.ackedGeneration
  }

  getConflict(): SaveConflict<Doc> | null {
    return this.conflict
  }

  /** Adopt a revision the caller hydrated from the server while clean. */
  hydrate(snapshot: Doc, revision: number) {
    this.baseline = this.snapshot = snapshot
    this.revision = revision
  }

  restore(state: SaveQueueState<Doc>) {
    this.baseline = state.baseline
    this.snapshot = state.snapshot
    this.revision = state.revision
    this.generation = state.generation
    this.ackedGeneration = state.ackedGeneration
    this.attempt = state.attempt
    this.conflict = state.conflict
    if (this.conflict) this.opts.onConflict(this.conflict)
  }

  persisted(): Promise<void> {
    return this.persistence
  }

  private checkpoint(): Promise<void> {
    const state: SaveQueueState<Doc> = {
      baseline: this.baseline,
      snapshot: this.snapshot,
      revision: this.revision,
      generation: this.generation,
      ackedGeneration: this.ackedGeneration,
      attempt: this.attempt,
      conflict: this.conflict,
    }
    this.persistence = this.persistence
      .then(() => this.opts.persist?.(state))
      .catch((error) => {
        // A storage failure must not stop a working connection from saving edits.
        this.opts.onPersistenceError?.(error)
      })
    return this.persistence
  }

  noteEdit() {
    this.snapshot = this.opts.getSnapshot()
    this.generation++
    // While a conflict is pending, edits accumulate but nothing is sent; the
    // resolution decides which revision they are based on.
    const sending =
      this.conflict === null && this.retryTimer === null && this.startSave()
    if (!sending) void this.checkpoint()
  }

  /**
   * Drain every generation observed so far. Resolves once the current
   * generation is acknowledged; rejects on save failure, pending conflict,
   * or disposal, leaving the local state dirty.
   */
  flush(): Promise<void> {
    if (this.conflict !== null) {
      return Promise.reject(new SaveConflictError())
    }
    if (!this.isDirty()) {
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      this.waiters.push({ generation: this.generation, resolve, reject })
      this.startSave()
    })
  }

  /** Resend the local snapshot over the conflicting server revision. */
  resolveKeepMine() {
    if (this.conflict === null) {
      return
    }
    this.revision = this.conflict.serverRevision
    this.baseline = this.conflict.serverDoc
    this.conflict = null
    this.startSave()
  }

  /**
   * Accept the server copy. The caller must have already replaced the local
   * content with the conflict's serverDoc; this only marks the queue clean.
   */
  resolveTakeServer() {
    if (this.conflict === null) {
      return
    }
    this.revision = this.conflict.serverRevision
    this.baseline = this.snapshot = this.conflict.serverDoc
    this.conflict = null
    this.attempt = null
    this.ackedGeneration = this.generation
    void this.checkpoint()
  }

  /** Abandon unsaved generations after an explicit user discard. */
  discardLocal() {
    this.conflict = null
    this.attempt = null
    this.ackedGeneration = this.generation
    this.clearTimers()
    void this.checkpoint()
  }

  dispose() {
    this.disposed = true
    this.clearTimers()
    this.rejectWaiters(new SaveQueueDisposedError())
  }

  /**
   * Undo a dispose. React StrictMode runs an effect's cleanup and setup
   * again on the same memoized queue, so disposal must be reversible; a
   * dirty queue schedules its save again.
   */
  activate() {
    this.disposed = false
    if (this.conflict === null && this.generation > this.ackedGeneration) {
      this.startSave()
    }
  }

  private clearTimers() {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  private startSave(): boolean {
    if (this.disposed || this.inFlight || this.conflict !== null) {
      return false
    }
    if (this.generation === this.ackedGeneration) {
      return false
    }
    this.clearTimers()
    this.inFlight = true
    // A lost response may hide a committed write. Retry the exact request.
    this.attempt ??= {
      generation: this.generation,
      snapshot: this.snapshot,
      revision: this.revision,
      requestId: crypto.randomUUID(),
    }
    const { generation, snapshot, revision, requestId } = this.attempt
    const send = () => {
      if (this.disposed) {
        this.inFlight = false
        return
      }
      void this.opts
        .performSave(snapshot, revision, requestId, this.baseline)
        .then(
          (result) => {
            this.inFlight = false
            if (this.disposed) return
            this.attempt = null
            if (result.status === 'ok') {
              this.baseline = snapshot
              this.revision = result.revision
              this.ackedGeneration = generation
              this.opts.onSaved(snapshot, result.revision)
              this.settleWaiters()
              void this.checkpoint()
              if (this.generation > this.ackedGeneration) this.startSave()
            } else {
              this.conflict = {
                serverDoc: result.serverDoc,
                serverRevision: result.serverRevision,
              }
              this.rejectWaiters(new SaveConflictError())
              void this.checkpoint()
              this.opts.onConflict(this.conflict)
            }
          },
          (error) => {
            this.inFlight = false
            if (this.disposed) return
            this.rejectWaiters(error)
            this.opts.onSaveError(error)
            if (!this.disposed) {
              this.retryTimer = setTimeout(
                () => this.startSave(),
                SAVE_RETRY_MS
              )
            }
          }
        )
    }
    if (this.opts.persist) void this.checkpoint().then(send)
    else send()
    return true
  }

  private settleWaiters() {
    const done = this.waiters.filter(
      (w) => w.generation <= this.ackedGeneration
    )
    this.waiters = this.waiters.filter(
      (w) => w.generation > this.ackedGeneration
    )
    done.forEach((w) => w.resolve())
  }

  private rejectWaiters(error: unknown) {
    const rejected = this.waiters
    this.waiters = []
    rejected.forEach((w) => w.reject(error))
  }
}
