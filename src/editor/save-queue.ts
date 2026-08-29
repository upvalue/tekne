// Serialized per-document save queue.
//
// Every local edit bumps a generation counter; a save captures the current
// generation and snapshot, and at most one request is in flight at a time.
// Acknowledging a save only covers the captured generation, so edits made
// while a request runs stay dirty and get their own request. Framework-free
// so it can be tested without React; useDocumentSync owns the wiring to the
// Jotai store and the network.

export const SAVE_DEBOUNCE_MS = 750
export const SAVE_MAX_WAIT_MS = 5000
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
  private conflict: SaveConflict<Doc> | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private waiters: Waiter[] = []
  private disposed = false

  constructor(
    private readonly opts: {
      revision: number
      getSnapshot: () => Doc
      performSave: (
        snapshot: Doc,
        expectedRevision: number
      ) => Promise<SaveResult<Doc>>
      /** The server acknowledged this snapshot at this revision. */
      onSaved: (snapshot: Doc, revision: number) => void
      /** A conditional write lost; autosave is paused until resolved. */
      onConflict: (conflict: SaveConflict<Doc>) => void
      onSaveError: (error: unknown) => void
    }
  ) {
    this.revision = opts.revision
  }

  isDirty(): boolean {
    return this.conflict !== null || this.generation > this.ackedGeneration
  }

  getConflict(): SaveConflict<Doc> | null {
    return this.conflict
  }

  /** Adopt a revision the caller hydrated from the server while clean. */
  setRevision(revision: number) {
    this.revision = revision
  }

  noteEdit() {
    this.generation++
    // While a conflict is pending, edits accumulate but nothing is sent; the
    // resolution decides which revision they are based on.
    if (this.conflict === null) {
      this.scheduleSave()
    }
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
    this.conflict = null
    this.ackedGeneration = this.generation
  }

  /** Abandon unsaved generations after an explicit user discard. */
  discardLocal() {
    this.conflict = null
    this.ackedGeneration = this.generation
    this.clearTimers()
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
      this.scheduleSave()
    }
  }

  private scheduleSave() {
    if (this.disposed) {
      return
    }
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = setTimeout(() => this.startSave(), SAVE_DEBOUNCE_MS)
    // The max-wait timer runs from the first unsaved edit and is not pushed
    // back by later ones, so continuous editing still saves periodically.
    if (this.maxWaitTimer === null) {
      this.maxWaitTimer = setTimeout(() => this.startSave(), SAVE_MAX_WAIT_MS)
    }
  }

  private clearTimers() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.maxWaitTimer !== null) {
      clearTimeout(this.maxWaitTimer)
      this.maxWaitTimer = null
    }
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  private startSave() {
    if (this.disposed || this.inFlight || this.conflict !== null) {
      return
    }
    if (this.generation === this.ackedGeneration) {
      return
    }
    this.clearTimers()
    this.inFlight = true
    const generation = this.generation
    const snapshot = this.opts.getSnapshot()
    void this.opts.performSave(snapshot, this.revision).then(
      (result) => {
        this.inFlight = false
        if (result.status === 'ok') {
          this.revision = result.revision
          this.ackedGeneration = generation
          this.opts.onSaved(snapshot, result.revision)
          this.settleWaiters()
          if (this.generation > this.ackedGeneration && !this.disposed) {
            // Edits landed during the request. Drain immediately when a
            // flush is waiting on them; otherwise debounce as usual.
            if (this.waiters.length > 0) {
              this.startSave()
            } else {
              this.scheduleSave()
            }
          }
        } else {
          this.conflict = {
            serverDoc: result.serverDoc,
            serverRevision: result.serverRevision,
          }
          this.rejectWaiters(new SaveConflictError())
          this.opts.onConflict(this.conflict)
        }
      },
      (error) => {
        this.inFlight = false
        this.rejectWaiters(error)
        this.opts.onSaveError(error)
        if (!this.disposed) {
          this.retryTimer = setTimeout(() => this.startSave(), SAVE_RETRY_MS)
        }
      }
    )
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
