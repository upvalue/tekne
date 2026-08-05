// ReadOnlyLine.tsx - Display-only line component for search results
// Uses the same CodeMirror syntax rendering as the editor, but without editing capabilities

import { useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { syntaxPlugin } from './line-editor/syntax-plugin'
import { Checkbox } from '@/components/vendor/Checkbox'
import { ClockIcon } from '@heroicons/react/16/solid'
import { BadgeButton } from '@/components/vendor/Badge'
import { formatTimeDisplay } from '@/lib/time'
import { cn } from '@/lib/utils'
import {
  baseLineThemeSpec,
  checkboxStateProps,
  INDENT_WIDTH_PIXELS,
} from './line-visuals'
import { LineGlyph } from './LineGlyph'

// The editor's base line theme plus read-only-specific rules
const readOnlyTheme = EditorView.theme(
  {
    ...baseLineThemeSpec,
    '.cm-content': {
      padding: '0',
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
  return (
    <Checkbox
      className="ml-2 pointer-events-none"
      tabIndex={-1}
      {...checkboxStateProps(status)}
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
        'ReadOnlyLine w-full py-1 flex items-start',
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
      <div className="ELine-leading">
        <LineGlyph
          pinned={!!datumPinnedAt}
          className="text-zinc-500 shrink-0"
        />
      </div>

      {/* Task checkbox */}
      {datumTaskStatus && (
        <div className="ELine-leading">
          <ReadOnlyCheckbox status={datumTaskStatus} />
        </div>
      )}

      {/* Timer badge */}
      {datumTimeSeconds !== undefined && (
        <div className="ELine-leading">
          <ReadOnlyTimerBadge time={datumTimeSeconds} />
        </div>
      )}

      {/* CodeMirror content */}
      <div className="cm-editor-container w-full ml-2" ref={cmRef} />
    </div>
  )
}

export default ReadOnlyLine
