import { expect, test } from 'vitest'
import { docMake, lineMake, type ZDoc } from '@/docs/schema'
import { applyDocumentPatch, diffDocuments } from '@/docs/document-patch'
import { openDocumentOutbox } from './document-outbox'
import { SaveQueue, type SaveQueueState, type SaveResult } from './save-queue'

const stateFor = (text: string): SaveQueueState<ZDoc> => {
  const baseline = docMake([lineMake(0, 'before')])
  const snapshot = docMake([{ ...baseline.children[0], mdContent: text }])
  return {
    baseline,
    snapshot,
    revision: 0,
    generation: 1,
    ackedGeneration: 0,
    attempt: null,
    conflict: null,
  }
}

test('committed drafts survive reopening, active tabs cannot claim each other, and scopes stay separate', async () => {
  const title = crypto.randomUUID()
  const a = await openDocumentOutbox(title, 'server-a')
  const stateA = stateFor('tab a')
  await a.write(stateA)
  const b = await openDocumentOutbox(title, 'server-a')
  expect(b.recovered).toBeNull()
  const stateB = stateFor('tab b')
  await b.write(stateB)
  const elsewhere = await openDocumentOutbox(title, 'server-b')
  expect(elsewhere.recovered).toBeNull()
  elsewhere.close()
  a.close()
  const restoredA = await openDocumentOutbox(title, 'server-a')
  expect(restoredA.recovered).toEqual(stateA)
  await restoredA.write({ ...stateA, ackedGeneration: 1 })
  restoredA.close()
  b.close()
  const restoredB = await openDocumentOutbox(title, 'server-a')
  expect(restoredB.recovered).toEqual(stateB)
  await restoredB.write({ ...stateB, ackedGeneration: 1 })
  restoredB.close()
})

test('blocked requests, closing, recovery and a lost acknowledgement persist edits exactly once', async () => {
  const title = crypto.randomUUID()
  const original = docMake([lineMake(0, 'before')])
  let local = original
  let server = original
  let revision = 0
  const receipts = new Map<string, number>()
  const requests: Array<{ id: string; send: () => SaveResult<ZDoc> }> = []
  const firstOutbox = await openDocumentOutbox(title, 'recovery-test')
  const first = new SaveQueue<ZDoc>({
    revision: 0,
    getSnapshot: () => local,
    persist: firstOutbox.write,
    performSave: (snapshot, expected, id, baseline) => {
      const patch = diffDocuments(baseline, snapshot)
      requests.push({
        id,
        send: () => {
          if (receipts.has(id))
            return { status: 'ok', revision: receipts.get(id)! }
          expect(expected).toBe(revision)
          server = applyDocumentPatch(server, patch)
          receipts.set(id, ++revision)
          return { status: 'ok', revision }
        },
      })
      return new Promise(() => {})
    },
    onSaved: () => {},
    onConflict: () => {},
    onSaveError: () => {},
  })
  local = docMake([{ ...original.children[0], mdContent: 'first edit' }])
  first.noteEdit()
  await first.persisted()
  await expect.poll(() => requests.length).toBe(1)
  // The server commits, but the acknowledgement never reaches this tab.
  requests[0].send()
  local = docMake([{ ...original.children[0], mdContent: 'second edit' }])
  first.noteEdit()
  await first.persisted()
  first.dispose()
  firstOutbox.close()

  const reopened = await openDocumentOutbox(title, 'recovery-test')
  expect(reopened.recovered?.snapshot.children[0].mdContent).toBe('second edit')
  expect(reopened.recovered?.attempt?.requestId).toBe(requests[0].id)
  local = reopened.recovered!.snapshot
  const retried: string[] = []
  const restored = new SaveQueue<ZDoc>({
    revision: 0,
    paused: true,
    getSnapshot: () => local,
    persist: reopened.write,
    performSave: async (snapshot, expected, id, baseline) => {
      retried.push(id)
      if (receipts.has(id)) return { status: 'ok', revision: receipts.get(id)! }
      expect(expected).toBe(revision)
      server = applyDocumentPatch(server, diffDocuments(baseline, snapshot))
      receipts.set(id, ++revision)
      return { status: 'ok', revision }
    },
    onSaved: () => {},
    onConflict: () => {},
    onSaveError: () => {},
  })
  restored.restore(reopened.recovered!)
  restored.activate()
  await restored.flush()
  await restored.persisted()
  expect(retried[0]).toBe(requests[0].id)
  expect(server).toEqual(local)
  expect(revision).toBe(2)
  expect(receipts.size).toBe(2)
  restored.dispose()
  reopened.close()
  const clean = await openDocumentOutbox(title, 'recovery-test')
  expect(clean.recovered).toBeNull()
  clean.close()
})
