import {
  generateTableOfContents,
  type TableOfContentsItem,
} from '@/docs/table-of-contents'
import { DocumentDetails } from '@/editor/DocumentDetails'
import { useDocTitle } from '@/hooks/useDocTitle'
import { Aggregate } from './Aggregate'
import { useAtomValue, useSetAtom } from 'jotai'
import { docAtom, focusedLineAtom } from '@/editor/state'
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

export const DocumentOverview = () => {
  const title = useDocTitle()
  const doc = useAtomValue(docAtom)
  const focusedLineIdx = useAtomValue(focusedLineAtom)
  const toc = generateTableOfContents(doc.children, focusedLineIdx ?? undefined)
  return (
    <div className="flex flex-1 flex-col">
      {toc.length > 0 && (
        <div className="px-3 pb-3 pt-1">
          <TableOfContents toc={toc} />
        </div>
      )}
      <div className="pb-3 pt-1">
        <Aggregate />
      </div>
      {title && (
        <footer aria-label="Document details" className="mt-auto px-3 pt-3">
          <DocumentDetails title={title} />
        </footer>
      )}
    </div>
  )
}
