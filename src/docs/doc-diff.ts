// doc-diff.ts - Shared "proposed change" model for diff previews
//
// Any feature that proposes edits to a document (tag renames, the agent
// panel, ...) reduces its proposal to a list of ProposedLineChange values,
// which the shared ChangeRows component renders as red/green line rows.

import type { ZDoc, ZLine } from '@/docs/schema'

/** The subset of a line that a read-only diff row renders. */
export type DiffLine = {
  mdContent: string
  indent: number
  datumTaskStatus?: 'complete' | 'incomplete' | 'unset'
  datumTimeSeconds?: number
  datumPinnedAt?: string
}

export type ProposedLineChange =
  | { kind: 'changed'; before: DiffLine; after: DiffLine }
  | { kind: 'inserted'; after: DiffLine }
  | { kind: 'deleted'; before: DiffLine }

export const toDiffLine = (line: ZLine): DiffLine => ({
  mdContent: line.mdContent,
  indent: line.indent,
  datumTaskStatus: line.datumTaskStatus,
  datumTimeSeconds: line.datumTimeSeconds,
  datumPinnedAt: line.datumPinnedAt,
})

const renderedFieldsEqual = (a: ZLine, b: ZLine): boolean =>
  a.mdContent === b.mdContent &&
  a.indent === b.indent &&
  a.datumTaskStatus === b.datumTaskStatus &&
  a.datumTimeSeconds === b.datumTimeSeconds &&
  a.datumPinnedAt === b.datumPinnedAt

/**
 * Diffs two versions of a document by line identity (`timeCreated`).
 * Unchanged lines are omitted. Changes come out in draft order, with
 * deletions interleaved where their neighbors sit in the base document.
 */
export const diffDocs = (base: ZDoc, draft: ZDoc): ProposedLineChange[] => {
  const baseIdx = new Map<string, number>()
  base.children.forEach((line, idx) => baseIdx.set(line.timeCreated, idx))
  const draftIds = new Set(draft.children.map((line) => line.timeCreated))

  const changes: ProposedLineChange[] = []
  // Deletions are emitted just before the first surviving line that follows
  // them in the base document; `nextDeletion` walks the base once.
  let nextDeletion = 0
  const flushDeletionsBefore = (baseBound: number) => {
    while (nextDeletion < baseBound) {
      const line = base.children[nextDeletion]
      if (!draftIds.has(line.timeCreated)) {
        changes.push({ kind: 'deleted', before: toDiffLine(line) })
      }
      nextDeletion++
    }
  }

  for (const line of draft.children) {
    const atBase = baseIdx.get(line.timeCreated)
    if (atBase === undefined) {
      changes.push({ kind: 'inserted', after: toDiffLine(line) })
    } else {
      flushDeletionsBefore(atBase)
      // A draft may reorder lines; treat a line whose base position was
      // already passed as unchanged/changed content-wise (no move rendering).
      nextDeletion = Math.max(nextDeletion, atBase + 1)
      const baseLine = base.children[atBase]
      if (!renderedFieldsEqual(baseLine, line)) {
        changes.push({
          kind: 'changed',
          before: toDiffLine(baseLine),
          after: toDiffLine(line),
        })
      }
    }
  }
  flushDeletionsBefore(base.children.length)

  return changes
}

export const proposalStats = (changes: ProposedLineChange[]) => {
  let changed = 0
  let inserted = 0
  let deleted = 0
  for (const change of changes) {
    if (change.kind === 'changed') changed++
    else if (change.kind === 'inserted') inserted++
    else deleted++
  }
  return { changed, inserted, deleted }
}

/** Short human summary, e.g. "3 changed · 1 added · 2 deleted". */
export const proposalSummary = (changes: ProposedLineChange[]): string => {
  const { changed, inserted, deleted } = proposalStats(changes)
  const parts: string[] = []
  if (changed) parts.push(`${changed} changed`)
  if (inserted) parts.push(`${inserted} added`)
  if (deleted) parts.push(`${deleted} deleted`)
  return parts.length > 0 ? parts.join(' · ') : 'No changes'
}
