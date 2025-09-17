// table-of-contents.ts - Logic for generating a tree-based table of contents from headings

import type { ZLine } from './schema'

export type TableOfContentsItem = {
  lineIdx: number;
  content: string;
  indentLevel: number;
  isActive: boolean;
}

/**
 * Generates a flat table of contents for headings in a document.
 * 
 * A heading is any line that begins with #, ##, or ### followed by a space.
 * Each item includes its indent level for rendering hierarchy and an isActive
 * flag indicating if it's the closest header to the focused line.
 * 
 * For example:
 * ```
 * - # heading 1        (indentLevel: 0)
 * -- # heading 2       (indentLevel: 1)
 * --- ### heading 3    (indentLevel: 2)
 * ```
 * 
 * @param lines Array of lines from the document
 * @param focusedLineIdx The currently focused line index (optional)
 * @returns Array of TableOfContentsItem with lineIdx, content, indentLevel, and isActive
 */
export function generateTableOfContents(lines: ZLine[], focusedLineIdx?: number): TableOfContentsItem[] {
  const result: TableOfContentsItem[] = []
  const indentStack: number[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Check if this line is a heading (starts with #, ##, or ### followed by space)
    const isHeading = /^#{1,3} /.test(line.mdContent)
    
    if (!isHeading) {
      continue
    }

    // Remove indent levels that are >= current line's indent
    while (indentStack.length > 0 && indentStack[indentStack.length - 1] >= line.indent) {
      indentStack.pop()
    }

    // Add current indent to stack
    indentStack.push(line.indent)

    const item: TableOfContentsItem = {
      lineIdx: i,
      content: line.mdContent,
      indentLevel: indentStack.length - 1,
      isActive: false // Will be set after all items are collected
    }

    result.push(item)
  }

  // Mark the header that is closest but before/at the focused line as active
  if (focusedLineIdx !== undefined && result.length > 0) {
    let activeIdx = -1
    
    // Find the closest header that comes at or before the focused line
    for (let i = 0; i < result.length; i++) {
      if (result[i].lineIdx <= focusedLineIdx) {
        activeIdx = i
      } else {
        break // Headers are in order, so we can stop here
      }
    }
    
    // If we found a header at or before the focused line, mark it as active
    if (activeIdx >= 0) {
      result[activeIdx].isActive = true
    }
  }

  return result
}