// Pure document transformations behind the line keymap (Enter, Tab,
// Backspace, delete-line). Each takes the current document and returns the
// next one — no store, no CodeMirror view — so the destructive editing paths
// are directly testable. The keymap in line-operations.ts is the thin layer
// that reads editor state, calls these, and requests focus.
import { produce } from 'immer'
import { lineMake, type ZDoc } from '@/docs/schema'

/**
 * Tab: a line may indent at most one level past its predecessor, and the
 * first line can never indent.
 */
export const canIndentLine = (doc: ZDoc, lineIdx: number): boolean =>
  lineIdx > 0 &&
  doc.children[lineIdx].indent <= doc.children[lineIdx - 1].indent

export const indentLine = (doc: ZDoc, lineIdx: number): ZDoc =>
  produce(doc, (draft) => {
    draft.children[lineIdx].indent += 1
    draft.children[lineIdx].timeUpdated = new Date().toISOString()
  })

/** Shift-Tab. Returns null when the line is already at the left margin. */
export const outdentLine = (doc: ZDoc, lineIdx: number): ZDoc | null => {
  if (doc.children[lineIdx].indent === 0) return null
  return produce(doc, (draft) => {
    draft.children[lineIdx].indent -= 1
  })
}

/**
 * Enter: insert a new line after lineIdx carrying `remainder` (the text that
 * sat after the cursor) at the same indent. Splitting a collapsed line
 * uncollapses it, since its children would otherwise swallow the new line.
 */
export const splitLine = (
  doc: ZDoc,
  lineIdx: number,
  remainder: string
): ZDoc =>
  produce(doc, (draft) => {
    const newLineObj = {
      ...lineMake(doc.children[lineIdx].indent),
      mdContent: remainder,
    }
    if (draft.children[lineIdx].collapsed) {
      delete draft.children[lineIdx].collapsed
    }
    draft.children.splice(lineIdx + 1, 0, newLineObj)
  })

/** Backspace at the very start of the first line: drop it if it's not alone. */
export const dropFirstLine = (doc: ZDoc): ZDoc | null => {
  if (doc.children.length === 1) return null
  return produce(doc, (draft) => {
    draft.children = draft.children.slice(1)
  })
}

/**
 * Backspace at the very start of a non-first line: splice this line's content
 * onto the previous line and remove it. Returns the next doc plus the cursor
 * position at the join point.
 */
export const mergeIntoPreviousLine = (
  doc: ZDoc,
  lineIdx: number,
  currentContent: string
): { doc: ZDoc; focus: { lineIdx: number; pos: number } } => {
  const prevLine = doc.children[lineIdx - 1]
  return {
    doc: produce(doc, (draft) => {
      draft.children[lineIdx - 1].mdContent =
        prevLine.mdContent.concat(currentContent)
      draft.children.splice(lineIdx, 1)
    }),
    focus: { lineIdx: lineIdx - 1, pos: prevLine.mdContent.length },
  }
}

/**
 * Delete a whole line. The last remaining line is cleared instead of
 * removed, so a document always has at least one line.
 */
export const removeLine = (
  doc: ZDoc,
  lineIdx: number
): { doc: ZDoc; focus: { lineIdx: number; pos: number } | null } => {
  if (doc.children.length === 1) {
    return {
      doc: produce(doc, (draft) => {
        draft.children[lineIdx].mdContent = ''
      }),
      focus: null,
    }
  }

  const focusIdx = lineIdx > 0 ? lineIdx - 1 : 0
  return {
    doc: produce(doc, (draft) => {
      draft.children.splice(lineIdx, 1)
    }),
    focus: {
      lineIdx: focusIdx,
      pos: doc.children[focusIdx]?.mdContent.length ?? 0,
    },
  }
}
