import { useAtomValue, useSetAtom, useStore } from 'jotai'
import {
  focusedLineAtom,
  commandPaletteOpenAtom,
  showLineNumbersAtom,
} from './state'
import { cycleTaskStatus, toggleCollapse } from './line-ops'
import { Checkbox } from '@/components/vendor/Checkbox'
import { GripVertical } from 'lucide-react'
import { useCodeMirror, type LineWithIdx } from './line-editor'
import { TimerBadge } from './TimerBadge'
import { cn } from '@/lib/utils'
import type { CollapseState } from '@/docs/collapse'
import type { GutterTimestamp } from '@/docs/gutters'
import { checkboxStateProps, INDENT_WIDTH_PIXELS } from './line-visuals'
import { LineGlyph } from './LineGlyph'
import {
  memo,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { CommandPalette } from './CommandPalette'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DropEdge } from './line-reorder'

type ELineProps = LineWithIdx & {
  hiddenCount?: number
  timestamp: GutterTimestamp | null
  collapseState: CollapseState
  isDragSelected: boolean
  isActiveDragLine: boolean
  dropEdge: DropEdge | null
  disableTimestampHover: boolean
  onDragHandleClick: (
    event: ReactMouseEvent<HTMLButtonElement>,
    lineIdx: number
  ) => void
  onEditorInteract: () => void
  /** Touch mode: taps select lines instead of focusing CodeMirror. */
  touchMode: boolean
  isTouchSelected: boolean
  /** No overlay while this line is text-edited, so CodeMirror gets taps. */
  isTouchEditing: boolean
  onTouchSelect: (lineIdx: number) => void
}

export const Gutter = ({
  timestamp,
  lineIdx,
  dragHandle,
  disableTimestampHover,
}: {
  timestamp: GutterTimestamp | null
  lineIdx: number
  dragHandle: React.ReactNode
  disableTimestampHover: boolean
}) => {
  const [isTimestampHovered, setIsTimestampHovered] = useState(false)
  const showLineNumbers = useAtomValue(showLineNumbersAtom)
  const showFullTimestamp =
    Boolean(timestamp) && isTimestampHovered && !disableTimestampHover

  return (
    <div className="ELine-gutter text-muted tabular-nums">
      <span
        className="ELine-gutter-text"
        onMouseEnter={() => setIsTimestampHovered(true)}
        onMouseLeave={() => setIsTimestampHovered(false)}
      >
        {showLineNumbers ? (
          <span className="text-muted">{lineIdx + 1}</span>
        ) : (
          <>
            <span className="ELine-gutter-timestamp-base">
              {timestamp?.defaultString}
            </span>
            {showFullTimestamp && (
              <span className="ELine-gutter-timestamp-full">
                {timestamp?.fullString}
              </span>
            )}
          </>
        )}
      </span>
      {dragHandle}
    </div>
  )
}

/**
 * The individual line editor React component. Note that the bulk of
 * the logic is contained in the line-editor.ts file which handles
 * CodeMirror integration; this component handles rendering React
 * components and other functionality that doesn't need to live in
 * the codemirror layer
 */
const ELineImpl = (lineInfo: ELineProps) => {
  const { cmRef, cmView } = useCodeMirror(lineInfo)
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lineInfo.line.id,
    disabled: lineInfo.collapseState === 'collapsed',
  })

  // Codemirror of course doesn't receive recreated
  // callbacks with new component state; this table
  // lets us update them on the fly

  const { line, timestamp, collapseState } = lineInfo

  const store = useStore()
  const setPaletteOpen = useSetAtom(commandPaletteOpenAtom)

  const isFocused = useAtomValue(focusedLineAtom) === lineInfo.lineIdx
  const paletteOpen = useAtomValue(commandPaletteOpenAtom)

  // This line renders the palette if it's focused and palette is open
  const shouldRenderPalette = isFocused && paletteOpen

  const lineIsHeader =
    line.mdContent.startsWith('### ') ||
    line.mdContent.startsWith('## ') ||
    line.mdContent.startsWith('# ')
  const headerLevel = line.mdContent.startsWith('### ')
    ? 3
    : line.mdContent.startsWith('##')
      ? 2
      : line.mdContent.startsWith('# ')
        ? 1
        : 0
  const style: CSSProperties & { '--line-indent': string } = {
    '--line-indent': `${line.indent * INDENT_WIDTH_PIXELS}px`,
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseDown={(event) => {
        if (
          event.target !== event.currentTarget ||
          event.button !== 0 ||
          lineInfo.touchMode
        )
          return
        event.preventDefault()
        lineInfo.onEditorInteract()
        const view = cmView.current
        if (view) {
          view.focus()
          view.dispatch({ selection: { anchor: view.state.doc.length } })
        }
      }}
      className={cn(
        'ELine relative w-full py-[3px] flex flex-wrap items-start',
        !line.mdContent && 'ELine-empty',
        collapseState === 'collapsed' && 'hidden',
        isFocused && 'ELine-focused',
        lineInfo.isTouchSelected && 'ELine-touch-selected',
        lineInfo.isDragSelected && 'ELine-drag-selected',
        lineInfo.isActiveDragLine && 'ELine-active-drag-line',
        isDragging && 'ELine-dragging',
        lineInfo.dropEdge === 'before' && 'ELine-drop-before',
        lineInfo.dropEdge === 'after' && 'ELine-drop-after'
      )}
    >
      <Gutter
        timestamp={timestamp}
        lineIdx={lineInfo.lineIdx}
        disableTimestampHover={lineInfo.disableTimestampHover}
        dragHandle={
          <button
            type="button"
            className={cn(
              'ELine-drag-handle',
              lineInfo.isDragSelected && 'ELine-drag-handle-selected'
            )}
            ref={setActivatorNodeRef}
            onClick={(event) =>
              lineInfo.onDragHandleClick(event, lineInfo.lineIdx)
            }
            onMouseDown={(event) => event.stopPropagation()}
            aria-label={`Select and drag line ${lineInfo.lineIdx + 1}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical width={14} height={14} />
          </button>
        }
      />
      <div
        className="ELine-indent"
        style={{
          flex: 'none',
          width: `${line.indent * INDENT_WIDTH_PIXELS}px`,
        }}
      />
      {!lineIsHeader && (
        <div className="ELine-leading w-4 justify-center">
          {line.datumTaskStatus ? (
            <Checkbox
              tabIndex={-1}
              aria-label={`Task status for line ${lineInfo.lineIdx + 1}`}
              {...checkboxStateProps(line.datumTaskStatus)}
              onCheckedChange={() => cycleTaskStatus(store, lineInfo.lineIdx)}
            />
          ) : (
            <button
              aria-label={`Toggle collapse for line ${lineInfo.lineIdx + 1}`}
              className="flex items-center justify-center w-4 h-[24px]"
              tabIndex={-1}
              onClick={() => toggleCollapse(store, lineInfo.lineIdx)}
            >
              <LineGlyph
                pinned={!!line.datumPinnedAt}
                collapseStart={collapseState === 'collapse-start'}
              />
            </button>
          )}
        </div>
      )}
      <TimerBadge lineInfo={lineInfo} time={line.datumTimeSeconds ?? 0} />
      <div
        className={cn(
          'cm-editor-container min-w-0 ml-2 pr-0',
          lineIsHeader && `ELine-header-${headerLevel}`
        )}
        ref={cmRef}
        data-line-idx={lineInfo.lineIdx}
        onPointerDown={lineInfo.onEditorInteract}
        onFocus={lineInfo.onEditorInteract}
      />

      {(lineInfo.hiddenCount ?? 0) > 0 && (
        <button
          className="ELine-hidden-count inline-flex items-center justify-center rounded px-1.5 ml-1.5 text-xs tabular-nums text-muted hover:bg-white/5 hover:text-text-2 focus-visible:outline-1 focus-visible:outline-accent cursor-pointer"
          aria-label={`Expand ${lineInfo.hiddenCount} hidden ${lineInfo.hiddenCount === 1 ? 'line' : 'lines'}`}
          onClick={() => toggleCollapse(store, lineInfo.lineIdx)}
        >
          +{lineInfo.hiddenCount}
        </button>
      )}

      <div
        className="ELine-tail"
        aria-hidden="true"
        onMouseDown={(event) => {
          if (lineInfo.touchMode || event.button !== 0) return
          event.preventDefault()
          lineInfo.onEditorInteract()
          const view = cmView.current
          if (view) {
            view.focus()
            view.dispatch({
              selection: {
                anchor: event.shiftKey
                  ? view.state.selection.main.anchor
                  : view.state.doc.length,
                head: view.state.doc.length,
              },
            })
          }
        }}
      />

      {lineInfo.touchMode && !lineInfo.isTouchEditing && (
        <button
          type="button"
          className="ELine-touch-overlay"
          aria-label={`Select line ${lineInfo.lineIdx + 1}`}
          onClick={() => lineInfo.onTouchSelect(lineInfo.lineIdx)}
        />
      )}

      {shouldRenderPalette && cmView.current && (
        <CommandPalette
          isOpen={true}
          onClose={() => setPaletteOpen(false)}
          lineIdx={lineInfo.lineIdx}
          view={cmView.current}
        />
      )}
    </div>
  )
}

/**
 * Memoized so a keystroke in one line doesn't re-render every other line.
 * Plain shallow comparison: every prop is either a scalar, a stable
 * callback, or kept referentially stable by the parent (lines via Immer's
 * structural sharing, timestamps via useStableGutterTimestamps).
 */
export const ELine = memo(ELineImpl)
