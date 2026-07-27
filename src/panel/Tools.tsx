import { docAtom } from '@/editor/state'
import { treeifyDoc, type ZTreeLine } from '@/docs/doc-analysis'
import type { ZDoc } from '@/docs/schema'
import { useAtom, useAtomValue } from 'jotai'
import { useMemo, useState } from 'react'
import { trpc } from '@/trpc/client'
import { tagManagerTargetAtom } from './state'
import { TagCard } from './tags/TagCard'
import { TagRenameDialog } from './tags/TagRenameDialog'
import { Input } from '@/components/vendor/Input'

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

export const Tools = () => {
  const doc = useAtomValue(docAtom)
  const activeTags = useMemo(() => getActiveTags(doc), [doc])
  const [renameTarget, setRenameTarget] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [highlightTarget, setHighlightTarget] = useAtom(tagManagerTargetAtom)

  const tagsList = trpc.tags.list.useQuery()
  const descriptions = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const tag of tagsList.data ?? []) {
      map.set(tag.name, tag.description)
    }
    return map
  }, [tagsList.data])

  const allTags = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const tags = tagsList.data ?? []
    if (needle === '') {
      return tags
    }
    return tags.filter((t) => t.name.toLowerCase().includes(needle))
  }, [tagsList.data, filter])

  return (
    <div className="space-y-6 p-4">
      <ToolsSection title="Document Tags">
        {activeTags.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 p-4 text-sm text-zinc-500">
            No active tags in this document
          </div>
        ) : (
          <div className="space-y-2">
            {activeTags.map((tag) => {
              // Active-tag names include the leading '#'
              const name = tag.tag.slice(1)
              return (
                <TagCard
                  key={name}
                  name={name}
                  description={descriptions.get(name) ?? null}
                  highlighted={highlightTarget === name}
                  onRename={(n) => {
                    setHighlightTarget(null)
                    setRenameTarget(n)
                  }}
                  stats={
                    <>
                      <span>{tag.lineCount} lines</span>
                      {tag.taskCount > 0 && <span>{tag.taskCount} tasks</span>}
                      {tag.uncheckedTaskCount > 0 && (
                        <span className="text-amber-300">
                          {tag.uncheckedTaskCount} unchecked
                        </span>
                      )}
                    </>
                  }
                />
              )
            })}
          </div>
        )}
      </ToolsSection>

      <ToolsSection title="All Tags">
        <Input
          aria-label="Filter tags"
          placeholder="Filter tags…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {tagsList.isLoading ? (
          <div className="rounded-lg border border-zinc-800 p-4 text-sm text-zinc-500">
            Loading tags…
          </div>
        ) : allTags.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 p-4 text-sm text-zinc-500">
            {filter ? 'No tags match the filter' : 'No tags yet'}
          </div>
        ) : (
          <div className="space-y-2">
            {allTags.map((tag) => (
              <TagCard
                key={tag.name}
                name={tag.name}
                description={tag.description}
                highlighted={highlightTarget === tag.name}
                onRename={(n) => {
                  setHighlightTarget(null)
                  setRenameTarget(n)
                }}
                stats={
                  tag.lineCount === 0 ? (
                    <span className="text-zinc-600">no occurrences</span>
                  ) : (
                    <>
                      <span>{tag.lineCount} lines</span>
                      <span>
                        {tag.docCount} doc{tag.docCount === 1 ? '' : 's'}
                      </span>
                    </>
                  )
                }
              />
            ))}
          </div>
        )}
      </ToolsSection>

      <TagRenameDialog
        tag={renameTarget}
        onClose={() => setRenameTarget(null)}
      />
    </div>
  )
}
