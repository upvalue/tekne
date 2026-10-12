// The touch-mode control bar: line navigation and actions as buttons, so a
// phone drives the editor without the software keyboard. Rendered by
// EditorShell; decides its own visibility from the display mode.
import { useEffect, useState, type ReactNode } from 'react'
import { useAtomValue, useStore } from 'jotai'
import {
  ChevronDown,
  ChevronUp,
  ChevronsDownUp,
  CheckSquare,
  Ellipsis,
  IndentDecrease,
  IndentIncrease,
  ListPlus,
  Check,
  Monitor,
  MoveDown,
  MoveUp,
  Pencil,
  Pause,
  Pin,
  Play,
  Plus,
  Redo2,
  Square,
  Timer,
  Trash2,
  Undo2,
} from 'lucide-react'
import { generateCollapse } from '@/docs/collapse'
import { setDisplayModeOverride, useDisplayMode } from '@/hooks/display-mode'
import { docAtom, globalTimerAtom, requestFocusLineAtom } from '../state'
import { findLineIndexById, getVisibleLineIds } from '../outline-selection'
import { canIndentLine } from '../line-editor/line-mutations'
import {
  canMoveBlockDown,
  canMoveBlockUp,
  deleteLine,
  indentLine,
  insertLineAbove,
  insertLineBelow,
  moveBlockDown,
  moveBlockUp,
  outdentLine,
  toggleCollapse,
  togglePin,
  toggleTask,
  toggleTimer,
} from '../line-ops'
import {
  isTimerPaused,
  pauseTimer,
  resumeTimer,
  startTimer,
  stopAndSaveTimer,
} from '../timer/timer-controller'
import { undo, redo } from '../undo'
import { scrollToLine } from '../navigation'
import { touchEditingLineIdAtom, touchSelectedLineIdAtom } from './touch-atoms'
import { stepVisibleLine } from './touch-nav'
import { scrollDeltaToReveal } from './touch-viewport'

/**
 * Height of the software keyboard covering the layout viewport, in px.
 * Fixed-bottom elements sit at the layout viewport's bottom, which the
 * keyboard covers; translating by this keeps the bar visible above it.
 */
const useVisualViewport = () => {
  const [viewport, setViewport] = useState({
    keyboardInset: 0,
    height: 0,
    offsetTop: 0,
  })

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const keyboardInset = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop
      )
      document.documentElement.style.setProperty(
        '--touch-keyboard-inset',
        `${keyboardInset}px`
      )
      setViewport({
        keyboardInset,
        height: vv.height,
        offsetTop: vv.offsetTop,
      })
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      document.documentElement.style.removeProperty('--touch-keyboard-inset')
    }
  }, [])

  return viewport
}

const useKeepEditingLineVisible = (
  editingLineIdx: number,
  viewport: ReturnType<typeof useVisualViewport>
) => {
  useEffect(() => {
    if (editingLineIdx === -1 || viewport.height === 0) return

    const animationFrame = requestAnimationFrame(() => {
      const editor = document.querySelector<HTMLElement>('.TEditor-scroll')
      const lineEditor = document.querySelector<HTMLElement>(
        `.cm-editor-container[data-line-idx="${editingLineIdx}"]`
      )
      const line = lineEditor?.closest<HTMLElement>('.ELine')
      if (!editor || !line) return

      const editorRect = editor.getBoundingClientRect()
      const lineRect = line.getBoundingClientRect()
      const editingBar = document.querySelector<HTMLElement>('.TouchBar')
      const visible = {
        top: Math.max(editorRect.top, viewport.offsetTop),
        bottom: Math.min(
          editorRect.bottom,
          editingBar?.getBoundingClientRect().top ??
            viewport.offsetTop + viewport.height
        ),
      }
      const delta = scrollDeltaToReveal(lineRect, visible)
      if (delta !== 0) editor.scrollBy({ top: delta })
    })

    return () => cancelAnimationFrame(animationFrame)
  }, [editingLineIdx, viewport])
}

export const TouchButton = ({
  label,
  onPress,
  disabled = false,
  children,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  children: ReactNode
}) => (
  <button
    type="button"
    aria-label={label}
    disabled={disabled}
    onClick={onPress}
    className="flex items-center justify-center min-w-10 min-h-11 rounded-lg text-text-2 active:bg-raised disabled:text-raised"
  >
    {children}
  </button>
)

const SheetAction = ({
  label,
  onPress,
  disabled = false,
  children,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  children: ReactNode
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onPress}
    className="flex items-center gap-3 w-full min-h-11 px-3 rounded-lg text-left text-sm text-text active:bg-raised disabled:text-muted"
  >
    {children}
    {label}
  </button>
)

export const TouchBar = () => {
  const store = useStore()
  const mode = useDisplayMode()
  const doc = useAtomValue(docAtom)
  const globalTimer = useAtomValue(globalTimerAtom)
  const selectedId = useAtomValue(touchSelectedLineIdAtom)
  const editingId = useAtomValue(touchEditingLineIdAtom)
  const [sheetOpen, setSheetOpen] = useState(false)
  const viewport = useVisualViewport()
  const editingLineIdx =
    editingId === null ? -1 : findLineIndexById(doc.children, editingId)
  useKeepEditingLineVisible(editingLineIdx, viewport)

  if (mode !== 'touch') return null

  const selectedIdx =
    selectedId === null ? null : findLineIndexById(doc.children, selectedId)
  const line =
    selectedIdx === null || selectedIdx === -1
      ? null
      : doc.children[selectedIdx]
  const lineIdx = line === null ? null : selectedIdx

  const selectByIdx = (idx: number) => {
    const target = store.get(docAtom).children[idx]
    if (!target) return
    store.set(touchSelectedLineIdAtom, target.id)
    scrollToLine(idx)
  }

  const step = (direction: 1 | -1) => {
    const { children: lines } = store.get(docAtom)
    const nextId = stepVisibleLine(
      lines,
      generateCollapse(lines),
      store.get(touchSelectedLineIdAtom),
      direction
    )
    if (nextId === null) return
    store.set(touchSelectedLineIdAtom, nextId)
    const idx = findLineIndexById(lines, nextId)
    if (idx !== -1) scrollToLine(idx)
  }

  const handleDelete = () => {
    if (lineIdx === null) return
    if (!confirm('Delete this line?')) return
    const lines = store.get(docAtom).children
    const visible = getVisibleLineIds(lines, generateCollapse(lines))
    const i = selectedId === null ? -1 : visible.indexOf(selectedId)
    const neighborId = visible[i + 1] ?? visible[i - 1] ?? null
    deleteLine(store, lineIdx, { requestFocus: false })
    store.set(touchSelectedLineIdAtom, neighborId)
    setSheetOpen(false)
  }

  const hasChildren =
    line !== null &&
    lineIdx !== null &&
    doc.children[lineIdx + 1] !== undefined &&
    doc.children[lineIdx + 1].indent > line.indent

  const timerRunningHere =
    line !== null && globalTimer.isActive && globalTimer.lineId === line.id

  const startEditing = () => {
    if (line === null || lineIdx === null) return
    store.set(touchEditingLineIdAtom, line.id)
    store.set(requestFocusLineAtom, {
      lineIdx,
      pos: line.mdContent.length,
    })
  }

  const stopEditing = () => {
    store.set(touchEditingLineIdAtom, null)
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }

  // While editing, the keyboard owns the screen: the bar shrinks to
  // undo/redo and Done, riding above the keyboard via the viewport inset.
  if (editingId !== null) {
    return (
      <div
        className="TouchBar fixed left-0 right-0 z-40 flex items-center gap-0.5 px-1 bg-raised/95 backdrop-blur border-t border-raised"
        style={{ bottom: viewport.keyboardInset }}
      >
        <TouchButton label="Undo" onPress={() => undo(store)}>
          <Undo2 width={20} height={20} />
        </TouchButton>
        <TouchButton label="Redo" onPress={() => redo(store)}>
          <Redo2 width={20} height={20} />
        </TouchButton>
        <div className="flex-1" />
        <TouchButton label="Done editing" onPress={stopEditing}>
          <Check width={20} height={20} />
        </TouchButton>
      </div>
    )
  }

  return (
    <>
      {sheetOpen && line !== null && lineIdx !== null && (
        <div className="TouchSheet fixed bottom-[calc(var(--notification-bar-height)+3.25rem)] left-0 right-0 z-40 mx-2 mb-2 p-2 rounded-xl bg-raised border border-raised shadow-xl space-y-1">
          <SheetAction
            label="Insert line above"
            onPress={() => {
              const idx = insertLineAbove(store, lineIdx)
              selectByIdx(idx)
              setSheetOpen(false)
            }}
          >
            <ListPlus width={18} height={18} className="rotate-180" />
          </SheetAction>
          <SheetAction
            label="Move block up"
            disabled={!canMoveBlockUp(doc.children, lineIdx)}
            onPress={() => {
              if (moveBlockUp(store, lineIdx) && selectedId !== null) {
                const idx = findLineIndexById(
                  store.get(docAtom).children,
                  selectedId
                )
                if (idx !== -1) scrollToLine(idx)
              }
            }}
          >
            <MoveUp width={18} height={18} />
          </SheetAction>
          <SheetAction
            label="Move block down"
            disabled={!canMoveBlockDown(doc.children, lineIdx)}
            onPress={() => {
              if (moveBlockDown(store, lineIdx) && selectedId !== null) {
                const idx = findLineIndexById(
                  store.get(docAtom).children,
                  selectedId
                )
                if (idx !== -1) scrollToLine(idx)
              }
            }}
          >
            <MoveDown width={18} height={18} />
          </SheetAction>
          <SheetAction
            label={line.collapsed ? 'Expand' : 'Collapse'}
            disabled={!hasChildren}
            onPress={() => toggleCollapse(store, lineIdx)}
          >
            <ChevronsDownUp width={18} height={18} />
          </SheetAction>
          <SheetAction
            label={line.datumTaskStatus ? 'Remove checkbox' : 'Add checkbox'}
            onPress={() => toggleTask(store, lineIdx)}
          >
            {line.datumTaskStatus ? (
              <Square width={18} height={18} />
            ) : (
              <CheckSquare width={18} height={18} />
            )}
          </SheetAction>
          <SheetAction
            label={line.datumPinnedAt ? 'Unpin line' : 'Pin line'}
            onPress={() => togglePin(store, lineIdx)}
          >
            <Pin width={18} height={18} />
          </SheetAction>
          <SheetAction
            label={
              line.datumTimeSeconds === undefined ? 'Add timer' : 'Remove timer'
            }
            onPress={() => toggleTimer(store, lineIdx)}
          >
            <Timer width={18} height={18} />
          </SheetAction>
          {line.datumTimeSeconds !== undefined && (
            <SheetAction
              label={
                timerRunningHere ? 'Stop and save timer' : 'Start stopwatch'
              }
              onPress={() => {
                if (timerRunningHere) {
                  void stopAndSaveTimer(store)
                } else {
                  void startTimer(store, {
                    line,
                    mode: 'stopwatch',
                    timeMode: store.get(globalTimerAtom).timeMode,
                    targetDuration: store.get(globalTimerAtom).targetDuration,
                  })
                }
              }}
            >
              {timerRunningHere ? (
                <Square width={18} height={18} />
              ) : (
                <Play width={18} height={18} />
              )}
            </SheetAction>
          )}
          {timerRunningHere && (
            <SheetAction
              label={
                isTimerPaused(globalTimer) ? 'Resume timer' : 'Pause timer'
              }
              onPress={() => {
                if (isTimerPaused(globalTimer)) {
                  void resumeTimer(store)
                } else {
                  void pauseTimer(store)
                }
              }}
            >
              {isTimerPaused(globalTimer) ? (
                <Play width={18} height={18} />
              ) : (
                <Pause width={18} height={18} />
              )}
            </SheetAction>
          )}
          <SheetAction label="Delete line" onPress={handleDelete}>
            <Trash2 width={18} height={18} />
          </SheetAction>
          <div className="flex items-center gap-1 border-t border-raised pt-1">
            <TouchButton label="Undo" onPress={() => undo(store)}>
              <Undo2 width={18} height={18} />
            </TouchButton>
            <TouchButton label="Redo" onPress={() => redo(store)}>
              <Redo2 width={18} height={18} />
            </TouchButton>
            <div className="flex-1" />
            <TouchButton
              label="Switch to desktop mode"
              onPress={() => setDisplayModeOverride('desktop')}
            >
              <Monitor width={18} height={18} />
            </TouchButton>
          </div>
        </div>
      )}

      <div className="TouchBar fixed bottom-[var(--notification-bar-height)] left-0 right-0 z-40 flex items-center justify-between gap-0.5 px-1 bg-raised/95 backdrop-blur border-t border-raised">
        <TouchButton label="Previous line" onPress={() => step(-1)}>
          <ChevronUp width={20} height={20} />
        </TouchButton>
        <TouchButton label="Next line" onPress={() => step(1)}>
          <ChevronDown width={20} height={20} />
        </TouchButton>
        <TouchButton
          label="Outdent line"
          disabled={line === null || line.indent === 0}
          onPress={() => {
            if (lineIdx !== null) outdentLine(store, lineIdx)
          }}
        >
          <IndentDecrease width={20} height={20} />
        </TouchButton>
        <TouchButton
          label="Indent line"
          disabled={lineIdx === null || !canIndentLine(doc, lineIdx)}
          onPress={() => {
            if (lineIdx !== null) indentLine(store, lineIdx)
          }}
        >
          <IndentIncrease width={20} height={20} />
        </TouchButton>
        <TouchButton
          label="Edit line"
          disabled={line === null}
          onPress={startEditing}
        >
          <Pencil width={20} height={20} />
        </TouchButton>
        <TouchButton
          label="Insert line below"
          disabled={lineIdx === null}
          onPress={() => {
            if (lineIdx === null) return
            selectByIdx(insertLineBelow(store, lineIdx))
          }}
        >
          <Plus width={20} height={20} />
        </TouchButton>
        <TouchButton
          label="More actions"
          disabled={line === null}
          onPress={() => setSheetOpen((v) => !v)}
        >
          <Ellipsis width={20} height={20} />
        </TouchButton>
      </div>
    </>
  )
}
