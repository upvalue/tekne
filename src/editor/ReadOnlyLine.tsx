import { useLayoutEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { syntaxPlugin } from './line-editor/syntax-plugin'
import { Checkbox } from '@/components/vendor/Checkbox'
import { Clock } from 'lucide-react'
import { renderTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import {
  baseLineThemeSpec,
  checkboxStateProps,
  INDENT_WIDTH_PIXELS,
} from './line-visuals'
import { LineGlyph } from './LineGlyph'

const readOnlyTheme = EditorView.theme(
  {
    ...baseLineThemeSpec,
    '.cm-content': {
      padding: '0',
    },
  },
  { dark: true }
)

/** Mount read-only CodeMirror using the editor's Markdown syntax rendering. */
const useReadOnlyCodeMirror = (content: string) => {
  const cmRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useLayoutEffect(() => {
    if (!cmRef.current) return

    if (viewRef.current) {
      viewRef.current.destroy()
    }

    const state = EditorState.create({
      doc: content,
      extensions: [
        readOnlyTheme,
        EditorView.lineWrapping,
        EditorView.editable.of(false),
        syntaxPlugin,
      ],
    })

    const view = new EditorView({
      state,
      parent: cmRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [content])

  return cmRef
}

const ReadOnlyCheckbox = ({
  status,
}: {
  status: 'complete' | 'incomplete' | 'unset'
}) => {
  return (
    <Checkbox
      className="pointer-events-none"
      tabIndex={-1}
      {...checkboxStateProps(status)}
      onCheckedChange={() => {}}
    />
  )
}

const ReadOnlyTimerBadge = ({ time }: { time: number }) => (
  <span
    aria-label={
      time > 0 ? `Recorded time: ${renderTime(time)}` : 'No time recorded'
    }
    className="inline-flex h-5 shrink-0 items-center gap-1.5 rounded bg-white/7 px-1.5 text-xs leading-5 tabular-nums text-text-2 whitespace-nowrap ml-2 mt-0.5"
  >
    <Clock size={time > 0 ? 11 : 14} />
    {time > 0 && renderTime(time)}
  </span>
)

export interface ReadOnlyLineProps {
  content: string
  indent: number
  datumTaskStatus?: 'complete' | 'incomplete' | 'unset'
  datumTimeSeconds?: number
  datumPinnedAt?: string
  onClick?: () => void
  className?: string
}

/** Render a read-only outline line with its task, timer, and gutter indicators. */
export const ReadOnlyLine = ({
  content,
  indent,
  datumTaskStatus,
  datumTimeSeconds,
  datumPinnedAt,
  onClick,
  className,
}: ReadOnlyLineProps) => {
  const cmRef = useReadOnlyCodeMirror(content)

  return (
    <div
      className={cn(
        'ReadOnlyLine w-full py-1 flex items-start leading-6',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <div
        style={{
          flex: 'none',
          width: `${indent * INDENT_WIDTH_PIXELS}px`,
        }}
      />

      <div className="ELine-leading min-h-6 w-4 justify-center">
        {datumTaskStatus ? (
          <ReadOnlyCheckbox status={datumTaskStatus} />
        ) : (
          <LineGlyph pinned={!!datumPinnedAt} />
        )}
      </div>

      {datumTimeSeconds !== undefined && (
        <ReadOnlyTimerBadge time={datumTimeSeconds} />
      )}

      <div className="cm-editor-container flex-1 min-w-0 ml-2" ref={cmRef} />
    </div>
  )
}

export default ReadOnlyLine
