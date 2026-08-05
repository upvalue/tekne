// Document-level handlers for line events emitted from CodeMirror (slash
// commands, gutter widgets). These events all carry a lineIdx and mutate the
// document by index, so one subscription per event type serves the whole
// editor — previously every mounted line subscribed to every event and
// filtered by index, costing O(lines) listener invocations per emit.
//
// The one line event NOT handled here is lineCollapseToggle, which needs the
// emitting line's CodeMirror view and stays in useCodeMirror.
import { useSetAtom, useStore } from 'jotai'
import { useCodemirrorEvent } from './line-editor/cm-events'
import { docAtom, globalTimerAtom, timerDialogRequestAtom } from './state'
import { cancelTimer } from './timer/timer-controller'

export const useDocumentLineEvents = () => {
  const store = useStore()
  const setDoc = useSetAtom(docAtom)

  useCodemirrorEvent('lineTimerToggle', (event) => {
    const line = store.get(docAtom).children[event.lineIdx]
    if (!line) return

    if (line.datumTimeSeconds === undefined) {
      setDoc((draft) => {
        draft.children[event.lineIdx].datumTimeSeconds = 0
      })
      return
    }

    // Removing an existing timer: confirm when it has recorded data, and
    // discard (not save) a running timer on this line. The prompt and the
    // timer transition happen before the state update — never inside the
    // Immer recipe.
    if (
      line.datumTimeSeconds > 0 &&
      !confirm('Timer has data, do you want to remove it?')
    ) {
      return
    }
    if (store.get(globalTimerAtom).lineTimeCreated === line.timeCreated) {
      cancelTimer(store)
    }
    setDoc((draft) => {
      delete draft.children[event.lineIdx].datumTimeSeconds
    })
  })

  useCodemirrorEvent('lineTimerOpen', (event) => {
    // Ensure timer exists on the line
    setDoc((draft) => {
      if (draft.children[event.lineIdx]?.datumTimeSeconds === undefined) {
        draft.children[event.lineIdx].datumTimeSeconds = 0
      }
    })
    // Request opening the timer dialog with the specified mode
    store.set(timerDialogRequestAtom, {
      lineIdx: event.lineIdx,
      mode: event.mode,
    })
  })

  useCodemirrorEvent('linePinToggle', (event) => {
    setDoc((draft) => {
      const line = draft.children[event.lineIdx]
      if (!line) return
      if (line.datumPinnedAt) {
        delete line.datumPinnedAt
      } else {
        line.datumPinnedAt = new Date().toISOString()
      }
    })
  })

  useCodemirrorEvent('lineTaskToggle', (event) => {
    setDoc((draft) => {
      const line = draft.children[event.lineIdx]
      if (!line) return
      if (line.datumTaskStatus) {
        delete line.datumTaskStatus
      } else {
        line.datumTaskStatus = 'unset'
      }
    })
  })

  useCodemirrorEvent('lineColorChange', (event) => {
    setDoc((draft) => {
      const line = draft.children[event.lineIdx]
      if (!line) return
      if (event.color === null) {
        delete line.color
      } else {
        line.color = event.color
      }
    })
  })
}
