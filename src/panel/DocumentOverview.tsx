import {
  generateTableOfContents,
  type TableOfContentsItem,
} from '@/docs/table-of-contents'
import { Aggregate } from './Aggregate'
import { useAtomValue, useSetAtom } from 'jotai'
import { docAtom, focusedLineAtom } from '@/editor/state'
import { ChevronDown } from 'lucide-react'
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
      className={cn(item.isActive ? 'font-bold' : '', 'cursor-pointer')}
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
    <div className="px-4">
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
    <div className={cn('flex flex-col gap-2 py-3', !flush && 'px-4')}>
      <h2 className={flush ? 'px-3' : undefined}>
        <button
          type="button"
          aria-expanded={!collapsed}
          className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs font-medium text-zinc-400 hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 cursor-pointer"
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronDown
            aria-hidden="true"
            className={`size-3.5 ${collapsed ? '-rotate-90' : ''}`}
          />
          {label}
        </button>
      </h2>
      <div className={`${collapsed ? 'hidden' : ''}`}>{children}</div>
    </div>
  )
}

export const DocumentOverview = () => {
  const doc = useAtomValue(docAtom)
  const focusedLineIdx = useAtomValue(focusedLineAtom)
  const toc = generateTableOfContents(doc.children, focusedLineIdx ?? undefined)
  return (
    <div>
      {toc.length > 0 && (
        <DocumentOverviewSection label="Table of Contents">
          <TableOfContents toc={toc} />
        </DocumentOverviewSection>
      )}
      <DocumentOverviewSection label="Aggregate" flush>
        <Aggregate />
      </DocumentOverviewSection>
    </div>
  )
}
