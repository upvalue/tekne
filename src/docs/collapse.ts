// collapse.ts - Logic for calculating which lines should be visually collapsed

import type { ZLine } from './schema'

export type CollapseState = 'collapsed' | 'uncollapsed' | 'collapse-start'

// NOTE-REDUCER: This is a document reducer that could be centralized

/**
 * Generates an array of booleans indicating which lines should be visually collapsed.
 *
 * A line is visually collapsed if:
 * 1. It comes after a line that has collapsed=true
 * 2. Its indent level is greater than the collapsed line's indent level
 * 3. No line with indent <= collapsed line's indent has appeared since the collapsed line
 *
 * Note: The line with collapsed=true itself is NOT visually collapsed.
 *
 * @param lines Array of lines from the document
 * @returns Array of booleans, one for each line indicating if it should be visually collapsed
 */
export function generateCollapse(lines: ZLine[]): CollapseState[] {
  const result: CollapseState[] = []
  let collapseLevel: number | null = null // The indent level that is currently collapsed

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // If this line has collapsed=true, it starts a new collapse section
    if (line.collapsed === true) {
      collapseLevel = line.indent
      result[i] = 'collapse-start' // The collapsed line itself is not visually collapsed
      continue
    }

    // If we're in a collapse section
    if (collapseLevel !== null) {
      // If this line's indent is <= the collapse level, exit collapse section
      if (line.indent <= collapseLevel) {
        collapseLevel = null
        result[i] = 'uncollapsed'
      } else {
        // This line is indented past the collapse level, so it's visually collapsed
        result[i] = 'collapsed'
      }
    } else {
      // No active collapse section
      result[i] = 'uncollapsed'
    }
  }

  return result
}
