// jsdom does not implement PointerEvent, which Base UI's interaction
// handling constructs on click. Back it with MouseEvent so pointer
// properties exist and dispatching works.
if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEvent extends MouseEvent {
    pointerId: number
    pointerType: string
    isPrimary: boolean

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
      this.pointerType = init.pointerType ?? ''
      this.isPrimary = init.isPrimary ?? false
    }
  }
  window.PointerEvent = PointerEvent as typeof globalThis.PointerEvent
}

export {}
