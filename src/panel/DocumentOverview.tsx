import {
  generateTableOfContents,
  type TableOfContentsItem,
} from '@/docs/table-of-contents'
import { DocumentDetails } from '@/editor/DocumentDetails'
import { useDocTitle } from '@/hooks/useDocTitle'
import { Aggregate } from './Aggregate'
import { useAtomValue, useSetAtom } from 'jotai'
import { docAtom, focusedLineAtom } from '@/editor/state'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { scrollToLine } from '@/editor/navigation'

export const TOCContent = ({ content }: { content: string }) => {
  // Strip leading #
  const strippedContent = content.replace(/^#+ /, '')

  return (
    <div>
      <span className="text-sm">{strippedContent}</span>
    </div>
  )
}

export const TOCItem = ({ item }: { item: TableOfContentsItem }) => {
  const setFocusedLine = useSetAtom(focusedLineAtom)

  return (
    <div
      style={{ paddingLeft: `${item.indentLevel * 12}px` }}
      className={cn(
        item.isActive ? 'text-text' : 'text-text-2',
        'cursor-pointer'
      )}
      onClick={() => {
        setFocusedLine(item.lineIdx)
        scrollToLine(item.lineIdx)
      }}
    >
      <TOCContent content={item.content} />
    </div>
  )
}

export const TableOfContents = ({ toc }: { toc: TableOfContentsItem[] }) => {
  return (
    <div className="px-0">
      {toc.map((item) => (
        <TOCItem key={item.lineIdx} item={item} />
      ))}
    </div>
  )
}

export const DocumentOverviewSection = ({
  label,
  children,
  flush = false,
}: {
  label: string
  children: React.ReactNode
  flush?: boolean
}) => {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={cn('flex flex-col gap-2 pb-3 pt-1', !flush && 'px-3')}>
      <h2 className={flush ? 'px-3' : undefined}>
        <button
          type="button"
          aria-expanded={!collapsed}
          className="flex w-full items-center gap-1.5 rounded px-0 py-1 text-left text-xs font-semibold text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-2 cursor-pointer"
          onClick={() => setCollapsed(!collapsed)}
        >
          {label}
        </button>
      </h2>
      <div className={`${collapsed ? 'hidden' : ''}`}>{children}</div>
    </div>
  )
}

export const DocumentOverview = () => {
  const title = useDocTitle()
  const doc = useAtomValue(docAtom)
  const focusedLineIdx = useAtomValue(focusedLineAtom)
  const toc = generateTableOfContents(doc.children, focusedLineIdx ?? undefined)
  return (
    <div>
      {toc.length > 0 && (
        <DocumentOverviewSection label="Outline">
          <TableOfContents toc={toc} />
        </DocumentOverviewSection>
      )}
      <DocumentOverviewSection label="Aggregate" flush>
        <Aggregate />
      </DocumentOverviewSection>
      {title && (
        <DocumentOverviewSection label="Document details">
          <DocumentDetails title={title} />
        </DocumentOverviewSection>
      )}
    </div>
  )
}
