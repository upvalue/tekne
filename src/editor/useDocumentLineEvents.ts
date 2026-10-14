// Subscribe once per document and delegate mutations to line-ops.
// Collapse stays in useCodeMirror because it needs the emitting line's view.
import { useStore } from 'jotai'
import { useCodemirrorEvent } from './line-editor/cm-events'
import { openTimerRow, togglePin, toggleTask, toggleTimer } from './line-ops'

export const useDocumentLineEvents = () => {
  const store = useStore()

  useCodemirrorEvent('lineTimerToggle', (event) => {
    void toggleTimer(store, event.lineIdx)
  })

  useCodemirrorEvent('lineTimerOpen', (event) => {
    openTimerRow(store, event.lineIdx, event.mode)
  })

  useCodemirrorEvent('linePinToggle', (event) => {
    togglePin(store, event.lineIdx)
  })

  useCodemirrorEvent('lineTaskToggle', (event) => {
    toggleTask(store, event.lineIdx)
  })
}
