import { useAtomValue, useSetAtom } from 'jotai'
import { docAtom, focusedLineAtom } from './state'
import { Checkbox } from '@/components/vendor/Checkbox'
import { Circle, CircleDot, Pin } from 'lucide-react'
import { useCodeMirror, type LineWithIdx } from './line-editor'
import { TimerBadge } from './TimerBadge'
import { cn } from '@/lib/utils'
import type { CollapseState } from '@/docs/collapse'
import type { ZLine } from '@/docs/schema';

type ELineProps = LineWithIdx & {
  timestamp: string | null
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

/**
 * The individual line editor React component. Note that the bulk of
 * the logic is contained in the line-editor.ts file which handles
 * CodeMirror integration; this component handles rendering React
 * components and other functionality that doesn't need to live in
 * the codemirror layer
 */
export const ELine = (lineInfo: ELineProps) => {
  const { cmRef } = useCodeMirror(lineInfo)

  // Codemirror of course doesn't receive recreated
  // callbacks with new component state; this table
  // lets us update them on the fly

  const { line, timestamp, collapseState } = lineInfo

  const setDoc = useSetAtom(docAtom)

  const isFocused = useAtomValue(focusedLineAtom) === lineInfo.lineIdx

  const getColorClass = (color?: string) => {
    return `editor-line-${color}`
  }

  // Disabled for now, experiment
  const lineIsHeader = line.mdContent.startsWith('### ') || line.mdContent.startsWith('## ') || line.mdContent.startsWith('# ');
  const headerLevel = line.mdContent.startsWith('### ') ? 3 : line.mdContent.startsWith('##') ? 2 : line.mdContent.startsWith('# ') ? 1 : 0;


  return (
    <div
      className={cn(
        'ELine w-full py-1  flex items-baseline',
        collapseState === 'collapsed' && 'hidden',
        isFocused && 'ELine-focused',
        getColorClass(line.color)
      )}
    >
      <div className="ELine-gutter text-zinc-600 text-sm flex-shrink-0 justify-end flex font-mono">
        {timestamp || ''}
      </div>
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
    </div>
  )
}
