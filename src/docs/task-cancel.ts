import { produce } from 'immer'
import { diffDocs, type ProposedLineChange } from './doc-diff'
import type { ZDoc } from './schema'

export type CancelUncheckedTasksResult = {
  doc: ZDoc
  changes: ProposedLineChange[]
}

/** Cancel unchecked tasks created before the cutoff. */
export const cancelUncheckedTasksBefore = (
  doc: ZDoc,
  cutoff: Date
): CancelUncheckedTasksResult => {
  const cutoffMs = cutoff.getTime()
  const next = produce(doc, (draft) => {
    for (const line of draft.children) {
      if (
        line.datumTaskStatus === 'unset' &&
        Date.parse(line.timeCreated) < cutoffMs
      ) {
        line.datumTaskStatus = 'incomplete'
      }
    }
  })

  return { doc: next, changes: diffDocs(doc, next) }
}
