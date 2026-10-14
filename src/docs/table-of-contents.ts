import type { ZLine } from './schema'

export type TableOfContentsItem = {
  lineIdx: number
  content: string
  indentLevel: number
  isActive: boolean
}

/** Headings nested by outline indent; the nearest heading at or before focus is active. */
export function generateTableOfContents(
  lines: ZLine[],
  focusedLineIdx?: number
): TableOfContentsItem[] {
  const result: TableOfContentsItem[] = []
  const indentStack: number[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const isHeading = /^#{1,3} /.test(line.mdContent)

    if (!isHeading) {
      continue
    }

    while (
      indentStack.length > 0 &&
      indentStack[indentStack.length - 1] >= line.indent
    ) {
      indentStack.pop()
    }

    indentStack.push(line.indent)

    const item: TableOfContentsItem = {
      lineIdx: i,
      content: line.mdContent,
      indentLevel: indentStack.length - 1,
      isActive: false, // Will be set after all items are collected
    }

    result.push(item)
  }

  // Mark the header that is closest but before/at the focused line as active
  if (focusedLineIdx !== undefined && result.length > 0) {
    let activeIdx = -1

    for (let i = 0; i < result.length; i++) {
      if (result[i].lineIdx <= focusedLineIdx) {
        activeIdx = i
      } else {
        break // Headers are in order, so we can stop here
      }
    }

    if (activeIdx >= 0) {
      result[activeIdx].isActive = true
    }
  }

  return result
}
