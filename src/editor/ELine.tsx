import { useAtomValue, useSetAtom } from 'jotai'
import { docAtom, focusedLineAtom, commandPaletteOpenAtom, showLineNumbersAtom, selectedLinesAtom } from './state'
import { Checkbox } from '@/components/vendor/Checkbox'
import { Circle, CircleDot, GripVertical, Pin } from 'lucide-react'
import { useCodeMirror, type LineWithIdx } from './line-editor'
import { TimerBadge } from './TimerBadge'
import { cn } from '@/lib/utils'
import type { CollapseState } from '@/docs/collapse'
import type { ZLine } from '@/docs/schema';
import type { GutterTimestamp } from '@/docs/gutters'
import { useCallback } from 'react'
import { CommandPalette } from '@/commands/CommandPalette'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export type ELineProps = LineWithIdx & {
  timestamp: GutterTimestamp | null
  collapseState: CollapseState
}

const INDENT_WIDTH_PIXELS = 24

const cycleCheckboxStatus = (status: 'complete' | 'incomplete' | 'unset') => {
  switch (status) {
    case 'complete':
      return 'incomplete'
    case 'incomplete':
      return 'unset'
    case 'unset':
      return 'complete'
  }
}

const checkboxStatus = (status: 'complete' | 'incomplete' | 'unset') => {
  switch (status) {
    case 'complete': return {
      checked: true,
      indeterminate: false,
    }
    case 'incomplete': return {
      checked: true,
      indeterminate: true,
    }
    case 'unset': return {
      checked: false,
      indeterminate: false,
    }
  }
}

const LineIcon = ({ line, collapseState }: { line: ZLine, collapseState: CollapseState }) => {
  if (line.datumPinnedAt) {
    return <Pin width={8} height={8} />
  }
  if (collapseState === 'collapse-start') {
    return <CircleDot width={8} height={8} />
  }
  return <Circle width={8} height={8} />
}

export const Gutter = ({
  timestamp,
  lineIdx,
  dragListeners,
  dragAttributes,
  setActivatorNodeRef,
}: {
  timestamp: GutterTimestamp | null
  lineIdx: number
  dragListeners?: Record<string, Function>
  dragAttributes?: Record<string, any>
  setActivatorNodeRef?: (el: HTMLElement | null) => void
}) => {
  const showLineNumbers = useAtomValue(showLineNumbersAtom)
  const setSelectedLines = useSetAtom(selectedLinesAtom)
  const selectedLines = useAtomValue(selectedLinesAtom)
  const isSelected = selectedLines.has(lineIdx)

  const handleGutterClick = useCallback((e: React.MouseEvent) => {
    if (e.shiftKey) {
      setSelectedLines((prev: Set<number>) => {
        const next = new Set(prev)
        if (prev.size > 0) {
          const existing = Array.from(prev).sort((a, b) => a - b)
          const anchor = existing[0]
          const from = Math.min(anchor, lineIdx)
          const to = Math.max(anchor, lineIdx)
          for (let i = from; i <= to; i++) next.add(i)
        } else {
          next.add(lineIdx)
        }
        return next
      })
    } else {
      setSelectedLines((prev: Set<number>) => {
        if (prev.has(lineIdx) && prev.size === 1) return new Set<number>()
        return new Set([lineIdx])
      })
    }
  }, [lineIdx, setSelectedLines])

  return <div
    className={cn(
      "ELine-gutter text-zinc-600 text-sm flex-shrink-0 justify-end flex font-mono items-center",
      isSelected && "ELine-gutter-selected"
    )}
    onClick={handleGutterClick}
  >
    <span className="ELine-gutter-content">
      {showLineNumbers
        ? <span className="text-zinc-500">{lineIdx + 1}</span>
        : timestamp && <>
            <span className="ELine-timestamp-default">{timestamp.defaultString}</span>
            <span className="ELine-timestamp-full">{timestamp.fullString}</span>
          </>
      }
    </span>
    <span
      ref={setActivatorNodeRef}
      className="ELine-drag-handle"
      {...dragListeners}
      {...dragAttributes}
    >
      <GripVertical width={14} height={14} />
    </span>
  </div>
}

/**
 * The individual line editor React component. Note that the bulk of
 * the logic is contained in the line-editor.ts file which handles
 * CodeMirror integration; this component handles rendering React
 * components and other functionality that doesn't need to live in
 * the codemirror layer
 */
export const ELine = (lineInfo: ELineProps) => {
  const { cmRef, cmView } = useCodeMirror(lineInfo)

  const { line, timestamp, collapseState } = lineInfo

  const setDoc = useSetAtom(docAtom)
  const setPaletteOpen = useSetAtom(commandPaletteOpenAtom)

  const isFocused = useAtomValue(focusedLineAtom) === lineInfo.lineIdx
  const paletteOpen = useAtomValue(commandPaletteOpenAtom)
  const selectedLines = useAtomValue(selectedLinesAtom)
  const isSelected = selectedLines.has(lineInfo.lineIdx)

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: line.timeCreated })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const shouldRenderPalette = isFocused && paletteOpen

  const getColorClass = (color?: string) => {
    return `editor-line-${color}`
  }

  const lineIsHeader = line.mdContent.startsWith('### ') || line.mdContent.startsWith('## ') || line.mdContent.startsWith('# ');
  const headerLevel = line.mdContent.startsWith('### ') ? 3 : line.mdContent.startsWith('##') ? 2 : line.mdContent.startsWith('# ') ? 1 : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'ELine group w-full py-1 flex items-baseline',
        collapseState === 'collapsed' && 'hidden',
        isFocused && 'ELine-focused',
        isSelected && 'ELine-selected',
        isDragging && 'ELine-dragging',
        getColorClass(line.color)
      )}
    >
      <Gutter
        timestamp={timestamp}
        lineIdx={lineInfo.lineIdx}
        dragListeners={listeners}
        dragAttributes={attributes}
        setActivatorNodeRef={setActivatorNodeRef}
      />
      <div
        style={{
          flex: 'none',
          width: `${line.indent * INDENT_WIDTH_PIXELS}px`,
        }}
      />
      {!lineIsHeader &&
        <LineIcon line={line} collapseState={collapseState} />
      }
      {line.datumTaskStatus && (
        <Checkbox
          className="ml-2"
          tabIndex={-1}
          {...checkboxStatus(line.datumTaskStatus)}
          onChange={() => {
            // TOOD: This pattern repeats itself and could be turned into a hook
            setDoc((draft) => {
              draft.children[lineInfo.lineIdx].datumTaskStatus = cycleCheckboxStatus(draft.children[lineInfo.lineIdx].datumTaskStatus || 'unset')
            })
          }}
        />
      )}

      {line.datumTimeSeconds !== undefined && (
        <TimerBadge lineInfo={lineInfo} time={line.datumTimeSeconds} />
      )}

      <div
        className={cn("cm-editor-container w-full ml-2 pr-[138px]", lineIsHeader && `ELine-header-${headerLevel}`)}
        ref={cmRef}
        data-line-idx={lineInfo.lineIdx}
      />

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
