import { zdoc, type ZDoc } from '@/docs/schema'
import { z } from 'zod'
import type { SaveQueueState } from './save-queue'

const DATABASE = 'tekne-document-outbox-v1'
const STORE = 'drafts'
const recoveredState = z.object({
  baseline: zdoc,
  snapshot: zdoc,
  revision: z.number().int().nonnegative(),
  generation: z.number().int().nonnegative(),
  ackedGeneration: z.number().int().nonnegative(),
  attempt: z
    .object({
      snapshot: zdoc,
      generation: z.number().int().nonnegative(),
      revision: z.number().int().nonnegative(),
      requestId: z.uuid(),
    })
    .nullable(),
  conflict: z
    .object({ serverDoc: zdoc, serverRevision: z.number().int().nonnegative() })
    .nullable(),
})
type Record = {
  id: string
  scope: string
  title: string
  state: SaveQueueState<ZDoc>
}
let database: Promise<IDBDatabase> | undefined

const openDatabase = () => {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () =>
      request.result
        .createObjectStore(STORE, { keyPath: 'id' })
        .createIndex('document', ['scope', 'title'])
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => {
        db.close()
        database = undefined
      }
      resolve(db)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () =>
      reject(
        new Error('Local recovery storage is blocked by another browser tab')
      )
  }).catch((error) => {
    database = undefined
    throw error
  })
  return database
}

// An open tab owns its record. Closed tabs release these locks automatically.
const claim = async (id: string): Promise<(() => void) | null> => {
  if (!navigator.locks)
    throw new Error('This browser does not support safe recovery across tabs')
  return new Promise((resolve, reject) => {
    void navigator.locks
      .request(`tekne-draft:${id}`, { ifAvailable: true }, async (lock) => {
        if (!lock) {
          resolve(null)
          return
        }
        await new Promise<void>((release) => resolve(release))
      })
      .catch(reject)
  })
}

export type DocumentOutbox = {
  recovered: SaveQueueState<ZDoc> | null
  otherDrafts: number
  write: (state: SaveQueueState<ZDoc>) => Promise<void>
  close: () => void
}

export const openDocumentOutbox = async (
  title: string,
  scope: string,
  signal?: AbortSignal
): Promise<DocumentOutbox> => {
  const db = await openDatabase()
  signal?.throwIfAborted()
  const records = await new Promise<Record[]>((resolve, reject) => {
    const request = db
      .transaction(STORE)
      .objectStore(STORE)
      .index('document')
      .getAll(IDBKeyRange.only([scope, title]))
    request.onsuccess = () => resolve(request.result as Record[])
    request.onerror = () => reject(request.error)
  })
  signal?.throwIfAborted()
  const candidates = records.filter(
    (record) => record.title === title && record.scope === scope
  )
  let recovered: Record | undefined
  let release: (() => void) | null = null
  for (const record of candidates) {
    release = await claim(record.id)
    if (signal?.aborted) {
      release?.()
      signal.throwIfAborted()
    }
    if (release) {
      // The previous owner may have saved or edited after our initial read.
      const current = await new Promise<Record | undefined>(
        (resolve, reject) => {
          const request = db
            .transaction(STORE)
            .objectStore(STORE)
            .get(record.id)
          request.onsuccess = () =>
            resolve(request.result as Record | undefined)
          request.onerror = () => reject(request.error)
        }
      ).catch((error) => {
        release?.()
        throw error
      })
      if (current) {
        recovered = current
        break
      }
      release()
      release = null
    }
  }
  const id = recovered?.id ?? crypto.randomUUID()
  release ??= await claim(id)
  if (!release) throw new Error('Could not acquire local recovery storage')
  if (signal?.aborted) {
    release()
    signal.throwIfAborted()
  }
  let state: SaveQueueState<ZDoc> | null = null
  try {
    if (recovered) {
      recoveredState.parse(recovered.state)
      // Validate without normalizing the stored snapshots: retries must reproduce
      // exactly the patch associated with the persisted request ID.
      state = recovered.state
    }
  } catch (error) {
    release()
    throw error
  }
  return {
    recovered: state,
    otherDrafts: candidates.length - (recovered ? 1 : 0),
    close: release,
    write: (state) =>
      new Promise<void>((resolve, reject) => {
        // Request strict durability where supported: success means transaction commit.
        const tx = db.transaction(STORE, 'readwrite', { durability: 'strict' })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () =>
          reject(tx.error ?? new Error('Local recovery write was aborted'))
        if (state.generation === state.ackedGeneration && !state.conflict)
          tx.objectStore(STORE).delete(id)
        else
          tx.objectStore(STORE).put({
            id,
            scope,
            title,
            state,
          } satisfies Record)
      }),
  }
}
