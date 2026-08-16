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

/** A document-sized unit for review UIs that show proposed edits. */
export type ProposedDocumentEdits = {
  title: string
  isTemplate: boolean
  changes: ProposedLineChange[]
}

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

const renderedFieldsKey = (line: ZLine): string =>
  JSON.stringify([
    line.mdContent,
    line.indent,
    line.datumTaskStatus,
    line.datumTimeSeconds,
    line.datumPinnedAt,
  ])

/**
 * Pair draft lines with base lines that share their creation timestamp.
 *
 * Current documents keep those timestamps unique, but older documents may
 * contain several lines created in the same millisecond. Match unchanged
 * duplicates first, then pair the remaining occurrences in order. That keeps
 * a single edit from making every line in a legacy collision group look
 * changed, while still giving changed duplicates a stable counterpart.
 */
const matchLines = (base: ZDoc, draft: ZDoc): Map<number, number> => {
  const baseGroups = new Map<string, number[]>()
  const draftGroups = new Map<string, number[]>()

  const addToGroup = (
    groups: Map<string, number[]>,
    timeCreated: string,
    index: number
  ) => {
    const group = groups.get(timeCreated)
    if (group) group.push(index)
    else groups.set(timeCreated, [index])
  }

  base.children.forEach((line, index) =>
    addToGroup(baseGroups, line.timeCreated, index)
  )
  draft.children.forEach((line, index) =>
    addToGroup(draftGroups, line.timeCreated, index)
  )

  const baseByDraft = new Map<number, number>()

  for (const [timeCreated, draftIndices] of draftGroups) {
    const baseIndices = baseGroups.get(timeCreated)
    if (!baseIndices) continue

    const exactBaseIndices = new Map<
      string,
      { indices: number[]; next: number }
    >()
    for (const baseIndex of baseIndices) {
      const key = renderedFieldsKey(base.children[baseIndex])
      const matches = exactBaseIndices.get(key)
      if (matches) matches.indices.push(baseIndex)
      else exactBaseIndices.set(key, { indices: [baseIndex], next: 0 })
    }

    const matchedBaseIndices = new Set<number>()
    const unmatchedDraftIndices: number[] = []
    for (const draftIndex of draftIndices) {
      const key = renderedFieldsKey(draft.children[draftIndex])
      const matches = exactBaseIndices.get(key)
      const baseIndex = matches?.indices[matches.next]
      if (!matches || baseIndex === undefined) {
        unmatchedDraftIndices.push(draftIndex)
        continue
      }

      matches.next += 1
      matchedBaseIndices.add(baseIndex)
      baseByDraft.set(draftIndex, baseIndex)
    }

    const unmatchedBaseIndices = baseIndices.filter(
      (baseIndex) => !matchedBaseIndices.has(baseIndex)
    )
    for (
      let index = 0;
      index <
      Math.min(unmatchedDraftIndices.length, unmatchedBaseIndices.length);
      index++
    ) {
      baseByDraft.set(unmatchedDraftIndices[index], unmatchedBaseIndices[index])
    }
  }

  return baseByDraft
}

/**
 * Diffs two versions of a document by line identity (`timeCreated`).
 * Unchanged lines are omitted. Changes come out in draft order, with
 * deletions interleaved where their neighbors sit in the base document.
 */
export const diffDocs = (base: ZDoc, draft: ZDoc): ProposedLineChange[] => {
  const baseByDraft = matchLines(base, draft)
  const matchedBaseIndices = new Set(baseByDraft.values())

  const changes: ProposedLineChange[] = []
  // Deletions are emitted just before the first surviving line that follows
  // them in the base document; `nextDeletion` walks the base once.
  let nextDeletion = 0
  const flushDeletionsBefore = (baseBound: number) => {
    while (nextDeletion < baseBound) {
      const line = base.children[nextDeletion]
      if (!matchedBaseIndices.has(nextDeletion)) {
        changes.push({ kind: 'deleted', before: toDiffLine(line) })
      }
      nextDeletion++
    }
  }

  for (const [draftIndex, line] of draft.children.entries()) {
    const atBase = baseByDraft.get(draftIndex)
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
