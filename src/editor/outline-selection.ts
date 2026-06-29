import type { CollapseState } from '@/docs/collapse'
import type { ZLine } from '@/docs/schema'

export type LineId = string

export type IndexRange = {
  start: number
  end: number
}

export const getLineId = (line: ZLine): LineId => line.timeCreated

export const findLineIndexById = (lines: ZLine[], lineId: LineId) =>
  lines.findIndex((line) => getLineId(line) === lineId)

export const getOutlineRange = (
  lines: ZLine[],
  lineIdx: number
): IndexRange => {
  const line = lines[lineIdx]
  if (!line) return { start: lineIdx, end: lineIdx }

  let end = lineIdx + 1
  while (end < lines.length && lines[end].indent > line.indent) {
    end += 1
  }

  return { start: lineIdx, end }
}

export const getOutlineIds = (lines: ZLine[], lineIdx: number): LineId[] => {
  const range = getOutlineRange(lines, lineIdx)
  return lines.slice(range.start, range.end).map(getLineId)
}

export const normalizeSelectedLineIds = (
  lines: ZLine[],
  selectedLineIds: LineId[]
): LineId[] => {
  const selectedSet = new Set(selectedLineIds)
  return lines.map(getLineId).filter((lineId) => selectedSet.has(lineId))
}

export const getSelectedRanges = (
  lines: ZLine[],
  selectedLineIds: LineId[]
): IndexRange[] => {
  const selectedSet = new Set(normalizeSelectedLineIds(lines, selectedLineIds))
  const ranges: IndexRange[] = []
  let rangeStart: number | null = null

  for (let i = 0; i < lines.length; i++) {
    if (selectedSet.has(getLineId(lines[i]))) {
      rangeStart ??= i
      continue
    }

    if (rangeStart !== null) {
      ranges.push({ start: rangeStart, end: i })
      rangeStart = null
    }
  }

  if (rangeStart !== null) {
    ranges.push({ start: rangeStart, end: lines.length })
  }

  return ranges
}

export const selectOutlineBlock = (lines: ZLine[], lineIdx: number): LineId[] =>
  getOutlineIds(lines, lineIdx)

export const selectOutlineRange = (
  lines: ZLine[],
  anchorId: LineId,
  targetId: LineId
): LineId[] => {
  const anchorIdx = findLineIndexById(lines, anchorId)
  const targetIdx = findLineIndexById(lines, targetId)
  if (anchorIdx === -1 || targetIdx === -1) return []

  const anchorRange = getOutlineRange(lines, anchorIdx)
  const targetRange = getOutlineRange(lines, targetIdx)
  const start = Math.min(anchorRange.start, targetRange.start)
  const end = Math.max(anchorRange.end, targetRange.end)

  return lines.slice(start, end).map(getLineId)
}

export const toggleOutlineBlockSelection = (
  lines: ZLine[],
  selectedLineIds: LineId[],
  lineIdx: number
): LineId[] => {
  const blockIds = getOutlineIds(lines, lineIdx)
  const selectedSet = new Set(selectedLineIds)
  const blockIsSelected = blockIds.every((lineId) => selectedSet.has(lineId))

  for (const lineId of blockIds) {
    if (blockIsSelected) {
      selectedSet.delete(lineId)
    } else {
      selectedSet.add(lineId)
    }
  }

  return normalizeSelectedLineIds(lines, [...selectedSet])
}

export const getVisibleLineIds = (
  lines: ZLine[],
  collapsedStates: CollapseState[]
): LineId[] =>
  lines
    .filter((_, index) => collapsedStates[index] !== 'collapsed')
    .map(getLineId)
