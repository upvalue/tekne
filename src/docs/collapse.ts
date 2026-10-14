import type { ZLine } from './schema'

export type CollapseState = 'collapsed' | 'uncollapsed' | 'collapse-start'

/** Mark collapsed descendants; the collapsed parent stays visible as collapse-start. */
export function generateCollapse(lines: ZLine[]): CollapseState[] {
  const result: CollapseState[] = []
  let collapseLevel: number | null = null // The indent level that is currently collapsed

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (collapseLevel !== null && line.indent > collapseLevel) {
      result[i] = 'collapsed'
      continue
    }
    collapseLevel = null

    if (line.collapsed === true) {
      collapseLevel = line.indent
      result[i] = 'collapse-start' // The collapsed line itself is not visually collapsed
      continue
    }

    result[i] = 'uncollapsed'
  }

  return result
}
