// ReadOnlyLine.tsx - Display-only line component for search results
// Uses the same CodeMirror syntax rendering as the editor, but without editing capabilities

import { useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { syntaxPlugin } from './line-editor/syntax-plugin'
import { Circle, Pin } from 'lucide-react'
import { Checkbox } from '@/components/vendor/Checkbox'
import { ClockIcon } from '@heroicons/react/16/solid'
import { BadgeButton } from '@/components/vendor/Badge'
import { formatTimeDisplay } from '@/lib/time'
import { cn } from '@/lib/utils'

const INDENT_WIDTH_PIXELS = 24

// Minimal theme matching the editor
const readOnlyTheme = EditorView.theme(
  {
    '.cm-line': {
      padding: '0',
    },
    '.cm-content': {
      padding: '0',
    },
    '&.cm-focused': {
      outline: 'none',
    },
  },
  { dark: true }
)

/**
 * Minimal CodeMirror setup for read-only display.
 * Uses the same syntaxPlugin as the editor for consistent rendering.
 */
const useReadOnlyCodeMirror = (content: string) => {
  const cmRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!cmRef.current) return

    // Clean up any existing view
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

// Display-only checkbox - shows state without interaction
const ReadOnlyCheckbox = ({
  status,
}: {
  status: 'complete' | 'incomplete' | 'unset'
}) => {
  const props = {
    complete: { checked: true, indeterminate: false },
    incomplete: { checked: true, indeterminate: true },
    unset: { checked: false, indeterminate: false },
  }[status]

  return (
    <Checkbox
      className="ml-2 pointer-events-none"
      tabIndex={-1}
      {...props}
      onChange={() => {}}
    />
  )
}

// Display-only timer badge - shows time without dialog
const ReadOnlyTimerBadge = ({ time }: { time: number }) => {
  return (
    <div className="ml-1">
      <BadgeButton
        className="whitespace-nowrap pointer-events-none"
        badgeClassName="px-[4px] py-[1px]"
      >
        <div className="flex items-center gap-1">
          <ClockIcon style={{ width: '16px', height: '16px' }} />
          {time > 0 && <span>{formatTimeDisplay(time)}</span>}
        </div>
      </BadgeButton>
    </div>
  )
}

const LineIcon = ({ isPinned }: { isPinned: boolean }) => {
  if (isPinned) {
    return <Pin width={8} height={8} className="text-zinc-500 shrink-0" />
  }
  return <Circle width={8} height={8} className="text-zinc-500 shrink-0" />
}

export interface ReadOnlyLineProps {
  content: string
  indent: number
  datumTaskStatus?: 'complete' | 'incomplete' | 'unset'
  datumTimeSeconds?: number
  datumPinnedAt?: string
  onClick?: () => void
  className?: string
}

/**
 * Read-only line display component.
 * Mirrors the visual structure of ELine but without editing capabilities.
 * Uses the same CodeMirror syntax plugin for consistent markdown rendering.
 */
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
        'ReadOnlyLine w-full py-1 flex items-baseline',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {/* Indent spacing */}
      <div
        style={{
          flex: 'none',
          width: `${indent * INDENT_WIDTH_PIXELS}px`,
        }}
      />

      {/* Line icon (bullet/pin) */}
      <LineIcon isPinned={!!datumPinnedAt} />

      {/* Task checkbox */}
      {datumTaskStatus && <ReadOnlyCheckbox status={datumTaskStatus} />}

      {/* Timer badge */}
      {datumTimeSeconds !== undefined && (
        <ReadOnlyTimerBadge time={datumTimeSeconds} />
      )}

      {/* CodeMirror content */}
      <div className="cm-editor-container w-full ml-2" ref={cmRef} />
    </div>
  )
}

export default ReadOnlyLine
