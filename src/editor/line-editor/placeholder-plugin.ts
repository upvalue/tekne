import { type Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view'
import { clientRectsFor, flattenRect } from './vendor/dom'

// This is the original placeholder plugin from CM
// Modified to we can add more logic around whether to render a placeholder or not

type ContentFn = (view: EditorView) => string

class Placeholder extends WidgetType {
  constructor(readonly content: ContentFn) {
    super()
  }

  toDOM(view: EditorView) {
    const wrap = document.createElement('span')
    wrap.className = 'cm-placeholder'
    wrap.style.pointerEvents = 'none'
    wrap.appendChild(document.createTextNode(this.content(view)))
    wrap.setAttribute('aria-hidden', 'true')
    return wrap
  }

  coordsAt(dom: HTMLElement) {
    const rects = dom.firstChild ? clientRectsFor(dom.firstChild) : []
    if (!rects.length) return null
    const style = window.getComputedStyle(dom.parentNode as HTMLElement)
    const rect = flattenRect(rects[0], style.direction != 'rtl')
    const lineHeight = parseInt(style.lineHeight)
    if (rect.bottom - rect.top > lineHeight * 1.5)
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.top + lineHeight,
      }
    return rect
  }

  ignoreEvent() {
    return false
  }
}

/// Extension that enables a placeholder—a piece of example content
/// to show when the editor is empty.
export function placeholder(
  content: ContentFn,
  // lineNumber: number,
  showPlaceholder: (view: EditorView) => boolean = () => true
): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      placeholder: DecorationSet

      constructor(readonly view: EditorView) {
        const { doc } = view.state
        const docEnd = doc.length

        this.placeholder = content
          ? Decoration.set([
              Decoration.widget({
                widget: new Placeholder(content),
                side: 1,
              }).range(docEnd),
            ])
          : Decoration.none
      }

      update() {
        const { doc } = this.view.state
        const docEnd = doc.length

        this.placeholder = content
          ? Decoration.set([
              Decoration.widget({
                widget: new Placeholder(content),
                side: 1,
              }).range(docEnd),
            ])
          : Decoration.none
      }

      get decorations() {
        return showPlaceholder(this.view) ? this.placeholder : Decoration.none
      }
    },
    { decorations: (v) => v.decorations }
  )
  return typeof content == 'string'
    ? [plugin, EditorView.contentAttributes.of({ 'aria-placeholder': content })]
    : plugin
}
