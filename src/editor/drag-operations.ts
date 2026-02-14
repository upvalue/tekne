import type { CollapseState } from '@/docs/collapse'
import type { ZLine } from '@/docs/schema'

/**
 * Given a set of selected indices, expand to include any collapsed
 * children beneath selected collapsed parents.
 */
export function expandCollapsedChildren(
  children: ZLine[],
  selectedIndices: number[],
  collapseStates: CollapseState[]
): number[] {
  const result = new Set(selectedIndices)

  for (const idx of selectedIndices) {
    if (collapseStates[idx] !== 'collapse-start') continue

    const parentIndent = children[idx].indent
    for (let i = idx + 1; i < children.length; i++) {
      if (children[i].indent <= parentIndent) break
      result.add(i)
    }
  }

  return Array.from(result).sort((a, b) => a - b)
}

/**
 * Compute the result of moving `draggedIndices` so they appear
 * at the position currently occupied by `insertBeforeIdx`.
 *
 * If `insertBeforeIdx` is children.length, the lines are moved to the end.
 *
 * Returns the new children array, or `null` if the move is a no-op.
 */
export function computeLineMove(
  children: ZLine[],
  draggedIndices: number[],
  insertBeforeIdx: number
): ZLine[] | null {
  if (draggedIndices.length === 0) return null

  const sorted = [...draggedIndices].sort((a, b) => a - b)

  // Check if this is a no-op: dragged block is already contiguous
  // and already at the target position
  const isContiguous = sorted.every(
    (val, i) => i === 0 || val === sorted[i - 1] + 1
  )
  if (isContiguous) {
    const blockStart = sorted[0]
    const blockEnd = sorted[sorted.length - 1]
    // No-op if inserting right before or right after the contiguous block
    if (insertBeforeIdx >= blockStart && insertBeforeIdx <= blockEnd + 1) {
      return null
    }
  }

  const draggedSet = new Set(sorted)
  const draggedLines = sorted.map((i) => children[i])
  const remaining: ZLine[] = []
  // Track where insertBeforeIdx lands in the remaining array
  let insertPos = 0

  for (let i = 0; i < children.length; i++) {
    if (draggedSet.has(i)) {
      // If dragged items are before the insert point,
      // the insert position effectively shifts left
      if (i < insertBeforeIdx) {
        // don't increment insertPos
      }
      continue
    }
    if (i === insertBeforeIdx) {
      insertPos = remaining.length
    }
    remaining.push(children[i])
  }

  // If insertBeforeIdx is at or past the end
  if (insertBeforeIdx >= children.length) {
    insertPos = remaining.length
  }

  const result = [
    ...remaining.slice(0, insertPos),
    ...draggedLines,
    ...remaining.slice(insertPos),
  ]

  return result
}

/**
 * Rebase the indent of moved lines so the first dragged line
 * matches the indent of the line above the insertion point.
 * All other dragged lines preserve their relative offsets.
 *
 * If inserting at position 0 (no line above), target indent is 0.
 */
export function rebaseIndent(
  newChildren: ZLine[],
  draggedTimeCreateds: Set<string>
): ZLine[] {
  // Find the first dragged line in the new array
  const firstDraggedIdx = newChildren.findIndex((l) =>
    draggedTimeCreateds.has(l.timeCreated)
  )
  if (firstDraggedIdx === -1) return newChildren

  const targetIndent =
    firstDraggedIdx > 0 ? newChildren[firstDraggedIdx - 1].indent : 0
  const originalBaseIndent = newChildren[firstDraggedIdx].indent
  const indentDelta = targetIndent - originalBaseIndent

  if (indentDelta === 0) return newChildren

  return newChildren.map((line) => {
    if (!draggedTimeCreateds.has(line.timeCreated)) return line
    return { ...line, indent: Math.max(0, line.indent + indentDelta) }
  })
}
