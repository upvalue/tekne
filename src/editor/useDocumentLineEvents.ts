// Document-level handlers for line events emitted from CodeMirror (slash
// commands, gutter widgets). These events all carry a lineIdx and mutate the
// document by index, so one subscription per event type serves the whole
// editor — previously every mounted line subscribed to every event and
// filtered by index, costing O(lines) listener invocations per emit.
//
// The mutations themselves live in line-ops.ts so non-CodeMirror callers
// (the touch controls) can invoke them directly. The one line event NOT
// handled here is lineCollapseToggle, which needs the emitting line's
// CodeMirror view and stays in useCodeMirror.
import { useStore } from 'jotai'
import { useCodemirrorEvent } from './line-editor/cm-events'
import {
  openTimerDialog,
  setLineColor,
  togglePin,
  toggleTask,
  toggleTimer,
} from './line-ops'

export const useDocumentLineEvents = () => {
  const store = useStore()

  useCodemirrorEvent('lineTimerToggle', (event) => {
    toggleTimer(store, event.lineIdx)
  })

  useCodemirrorEvent('lineTimerOpen', (event) => {
    openTimerDialog(store, event.lineIdx, event.mode)
  })

  useCodemirrorEvent('linePinToggle', (event) => {
    togglePin(store, event.lineIdx)
  })

  useCodemirrorEvent('lineTaskToggle', (event) => {
    toggleTask(store, event.lineIdx)
  })

  useCodemirrorEvent('lineColorChange', (event) => {
    setLineColor(store, event.lineIdx, event.color)
  })
}
