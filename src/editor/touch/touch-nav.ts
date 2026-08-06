// Pure step-navigation over the visible (uncollapsed) line sequence.
import type { ZLine } from '@/docs/schema'
import type { CollapseState } from '@/docs/collapse'
import { getVisibleLineIds, type LineId } from '../outline-selection'

/**
 * The next (+1) or previous (-1) visible line id from currentId. With no
 * current selection, steps in from the top or bottom of the document. At the
 * edges the selection stays put. Null only for an empty document.
 */
export const stepVisibleLine = (
  lines: ZLine[],
  collapsedStates: CollapseState[],
  currentId: LineId | null,
  direction: 1 | -1
): LineId | null => {
  const visible = getVisibleLineIds(lines, collapsedStates)
  if (visible.length === 0) return null

  const fallback = direction === 1 ? visible[0] : visible[visible.length - 1]
  if (currentId === null) return fallback

  const i = visible.indexOf(currentId)
  // A stale id (line deleted, or hidden by a collapse) restarts from an edge.
  if (i === -1) return fallback

  const next = i + direction
  if (next < 0 || next >= visible.length) return currentId
  return visible[next]
}
