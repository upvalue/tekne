// Lifted from @codemirror/view 6.38.1 (src/dom.ts), MIT licensed.
//
// placeholder-plugin.ts is a fork of CodeMirror's own placeholder plugin and
// needs these two helpers to implement WidgetType.coordsAt. They aren't part
// of the @codemirror/view public API, so there's nothing to import -- hence
// the copy. Kept verbatim so it stays easy to diff against upstream.

/// Basic rectangle type.
export interface Rect {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
}

let scratchRange: Range | null

function textRange(node: Text, from: number, to = from) {
  const range = scratchRange || (scratchRange = document.createRange())
  range.setEnd(node, to)
  range.setStart(node, from)
  return range
}

export function clientRectsFor(dom: Node) {
  if (dom.nodeType == 3)
    return textRange(dom as Text, 0, dom.nodeValue!.length).getClientRects()
  else if (dom.nodeType == 1) return (dom as HTMLElement).getClientRects()
  else return [] as any as DOMRectList
}

export function flattenRect(rect: Rect, left: boolean) {
  const x = left ? rect.left : rect.right
  return { left: x, right: x, top: rect.top, bottom: rect.bottom }
}
