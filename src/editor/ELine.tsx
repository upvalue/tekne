import { useAtomValue, useSetAtom } from 'jotai'
import { docAtom, focusedLineAtom } from './state'
import { Checkbox } from '@/components/vendor/Checkbox'
import { Circle, CircleDot } from 'lucide-react'
import { useCodeMirror, type LineWithIdx } from './line-editor'
import { TimerBadge } from './TimerBadge'
import { cn } from '@/lib/utils'
import type { CollapseState } from './collapse'

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
  const lineIsHeader = false; // line.indent === 0 && line.mdContent.startsWith('# ');

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
      {!lineIsHeader &&
        <>
          <div
            style={{
              flex: 'none',
              width: `${line.indent * INDENT_WIDTH_PIXELS}px`,
            }}
          />
          <div className="flex items-center">
            &nbsp;
            {collapseState === 'collapse-start' ? (
              <CircleDot width={8} height={8} />
            ) : (
              <Circle width={8} height={8} />
            )}
          </div>
        </>
      }

      {line.datumTaskStatus && (
        <Checkbox
          className="ml-2"
          tabIndex={-1}
          {...checkboxStatus(line.datumTaskStatus)}
          onChange={(e) => {
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
        className={cn("cm-editor-container w-full ml-2 pr-[138px]", lineIsHeader && "ELine-header")}
        ref={cmRef}
        data-line-idx={lineInfo.lineIdx}
      />
    </div>
  )
}
