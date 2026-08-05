// Visual constants shared between the editable line (ELine / line-editor)
// and the read-only line used in search results, so the two renders can't
// drift. The shared LineGlyph component lives in LineGlyph.tsx (components
// get their own file for fast refresh).

export const INDENT_WIDTH_PIXELS = 24

/**
 * CodeMirror theme rules common to editable and read-only line views.
 * (`&` targets the editor root — a bare `.cm-focused` selector would only
 * match descendants and silently do nothing.)
 */
export const baseLineThemeSpec = {
  '.cm-line': {
    padding: '0',
  },
  '&.cm-focused': {
    outline: 'none',
  },
}

/** Map a task status to Checkbox props. */
export const checkboxStateProps = (
  status: 'complete' | 'incomplete' | 'unset'
) => {
  switch (status) {
    case 'complete':
      return { checked: true, indeterminate: false }
    case 'incomplete':
      return { checked: true, indeterminate: true }
    case 'unset':
      return { checked: false, indeterminate: false }
  }
}
