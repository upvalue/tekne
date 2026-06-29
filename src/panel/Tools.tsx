import { docAtom } from '@/editor/state'
import { treeifyDoc, type ZTreeLine } from '@/docs/doc-analysis'
import type { ZDoc } from '@/docs/schema'
import { TagIcon } from '@heroicons/react/24/outline'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'

type ActiveTag = {
  tag: string
  lineCount: number
  taskCount: number
  uncheckedTaskCount: number
}

const walkLines = (lines: ZTreeLine[], visit: (line: ZTreeLine) => void) => {
  for (const line of lines) {
    visit(line)
    walkLines(line.children, visit)
  }
}

const getActiveTags = (doc: ZDoc): ActiveTag[] => {
  const docTree = treeifyDoc(doc)
  const activeTags = new Map<string, ActiveTag>()

  walkLines(docTree.children, (line) => {
    for (const tag of new Set(line.tags)) {
      const tagInfo =
        activeTags.get(tag) ??
        activeTags
          .set(tag, {
            tag,
            lineCount: 0,
            taskCount: 0,
            uncheckedTaskCount: 0,
          })
          .get(tag)!

      tagInfo.lineCount += 1

      if (line.datumTaskStatus) {
        tagInfo.taskCount += 1
      }

      if (line.datumTaskStatus === 'unset') {
        tagInfo.uncheckedTaskCount += 1
      }
    }
  })

  return [...activeTags.values()].sort((a, b) => a.tag.localeCompare(b.tag))
}

const ToolsSection = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h2>
      {children}
    </section>
  )
}

const ActiveTags = ({ tags }: { tags: ActiveTag[] }) => {
  if (tags.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 p-4 text-sm text-zinc-500">
        No active tags in this document
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {tags.map((tag) => (
        <div
          key={tag.tag}
          className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
        >
          <div className="flex items-center gap-2">
            <TagIcon className="size-4 text-zinc-500" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">
              {tag.tag}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-400">
            <span>{tag.lineCount} lines</span>
            {tag.taskCount > 0 && <span>{tag.taskCount} tasks</span>}
            {tag.uncheckedTaskCount > 0 && (
              <span className="text-amber-300">
                {tag.uncheckedTaskCount} unchecked
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export const Tools = () => {
  const doc = useAtomValue(docAtom)
  const activeTags = useMemo(() => getActiveTags(doc), [doc])

  return (
    <div className="space-y-6 p-4">
      <ToolsSection title="Active Tags">
        <ActiveTags tags={activeTags} />
      </ToolsSection>
    </div>
  )
}
