import type { ZLine } from '@/docs/schema'
import {
  findLineIndexById,
  getLineId,
  getOutlineRange,
  getSelectedRanges,
  normalizeSelectedLineIds,
  type LineId,
} from './outline-selection'

export type DropEdge = 'before' | 'after'

export type MoveSelectedLinesArgs = {
  lines: ZLine[]
  selectedLineIds: LineId[]
  targetId: LineId
  edge: DropEdge
  touchedLineId: LineId
  now: string
}

export type MoveSelectedLinesResult = {
  lines: ZLine[]
  moved: boolean
}

const rangeStrictlyContainsIndex = (
  range: { start: number; end: number },
  index: number
) => index > range.start && index < range.end

const sameOrder = (a: ZLine[], b: ZLine[]) =>
  a.length === b.length &&
  a.every((line, index) => getLineId(line) === getLineId(b[index]))

export const moveSelectedLines = ({
  lines,
  selectedLineIds,
  targetId,
  edge,
  touchedLineId,
  now,
}: MoveSelectedLinesArgs): MoveSelectedLinesResult => {
  const normalizedSelectedIds = normalizeSelectedLineIds(lines, selectedLineIds)
  if (normalizedSelectedIds.length === 0) return { lines, moved: false }

  const selectedIdSet = new Set(normalizedSelectedIds)
  if (!selectedIdSet.has(touchedLineId)) return { lines, moved: false }

  const targetIdx = findLineIndexById(lines, targetId)
  if (targetIdx === -1) return { lines, moved: false }

  const selectedRanges = getSelectedRanges(lines, normalizedSelectedIds)
  const targetRange = getOutlineRange(lines, targetIdx)
  const destinationIndex =
    edge === 'before' ? targetRange.start : targetRange.end

  if (
    selectedRanges.some((range) =>
      rangeStrictlyContainsIndex(range, destinationIndex)
    )
  ) {
    return { lines, moved: false }
  }

  const movingLines = selectedRanges.flatMap((range) =>
    lines.slice(range.start, range.end)
  )
  const remainingLines = lines.filter(
    (line) => !selectedIdSet.has(getLineId(line))
  )
  const removedBeforeDestination = selectedRanges.reduce((count, range) => {
    if (range.start >= destinationIndex) return count
    return count + range.end - range.start
  }, 0)
  const adjustedDestinationIndex = destinationIndex - removedBeforeDestination

  const reorderedLines = [
    ...remainingLines.slice(0, adjustedDestinationIndex),
    ...movingLines,
    ...remainingLines.slice(adjustedDestinationIndex),
  ]

  if (sameOrder(lines, reorderedLines)) {
    return { lines, moved: false }
  }

  return {
    lines: reorderedLines.map((line) =>
      getLineId(line) === touchedLineId ? { ...line, timeUpdated: now } : line
    ),
    moved: true,
  }
}
