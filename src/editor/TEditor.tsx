import { useRef, useMemo, useCallback } from 'react'

import { useAtom, useAtomValue, useSetAtom } from 'jotai'

import { useCodemirrorEvent } from './line-editor'
import { docAtom, focusedLineAtom, selectedLinesAtom } from './state'
import { generateGutterTimestamps } from '@/docs/gutters'
import { generateCollapse } from '@/docs/collapse'
import { ELine } from './ELine'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensors,
  useSensor,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { computeLineMove, expandCollapsedChildren, rebaseIndent } from './drag-operations'

/**
 * The top level editor component.
 */
export const TEditor = () => {
  const [doc, setDoc] = useAtom(docAtom)
  const containerRef = useRef<HTMLDivElement>(null)
  const focusedLine = useAtomValue(focusedLineAtom)
  const setFocusedLine = useSetAtom(focusedLineAtom)
  const [selectedLines, setSelectedLines] = useAtom(selectedLinesAtom)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Something to think about: these functions
  // both touch every line and their logic could be combined
  // so that we're not alloc'ing and looping unnecessarily.
  // But for now perf is fine.

  const gutterTimestamps = useMemo(() => {
    return generateGutterTimestamps(doc.children)
  }, [doc.children])

  const collapsedStates = useMemo(() => {
    return generateCollapse(doc.children)
  }, [doc.children])

  const sortableIds = useMemo(() => {
    return doc.children.map((l) => l.timeCreated)
  }, [doc.children])

  useCodemirrorEvent('tagClick', (event) => {
    console.log('Tag clicked', event.name)
  })

  const handleDragStart = useCallback((_event: DragStartEvent) => {
    // Selection is managed by gutter clicks, not by drag start.
    // If the user hasn't selected lines, we just drag the single grabbed line
    // without highlighting it.
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeIdx = doc.children.findIndex((l) => l.timeCreated === activeId)
    const overIdx = doc.children.findIndex((l) => l.timeCreated === overId)
    if (activeIdx === -1 || overIdx === -1) return

    // If the active line is in a multi-selection, drag all selected lines.
    // Otherwise drag just the one line (with its collapsed children).
    const isMultiSelect = selectedLines.has(activeIdx) && selectedLines.size > 1
    const draggedIndices = isMultiSelect
      ? expandCollapsedChildren(doc.children, Array.from(selectedLines), collapsedStates)
      : expandCollapsedChildren(doc.children, [activeIdx], collapsedStates)

    // Determine insert position: if moving down, insert after overIdx; if moving up, insert before
    const insertBeforeIdx = activeIdx < overIdx ? overIdx + 1 : overIdx

    let newChildren = computeLineMove(doc.children, draggedIndices, insertBeforeIdx)
    if (!newChildren) return

    // Rebase indent so dragged lines match their new neighborhood
    const draggedTimeCreateds = new Set(draggedIndices.map((i) => doc.children[i].timeCreated))
    newChildren = rebaseIndent(newChildren, draggedTimeCreateds)

    // Update focused line to follow its new position
    if (focusedLine !== null) {
      const focusedTimeCreated = doc.children[focusedLine]?.timeCreated
      if (focusedTimeCreated) {
        const newFocusIdx = newChildren.findIndex((l) => l.timeCreated === focusedTimeCreated)
        if (newFocusIdx !== -1) {
          setFocusedLine(newFocusIdx)
        }
      }
    }

    setDoc((draft) => {
      draft.children = newChildren!
    })

    // Clear selection after drop
    setSelectedLines(new Set<number>())
  }, [doc.children, selectedLines, collapsedStates, focusedLine, setDoc, setFocusedLine, setSelectedLines])

  const handleDragCancel = useCallback(() => {
    // No state cleanup needed, selection persists
  }, [])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div ref={containerRef} className="max-h-[88vh] overflow-y-auto pb-32">
          {doc.children.map((l, i) => (
            <ELine
              key={l.timeCreated}
              line={l}
              lineIdx={i}
              timestamp={gutterTimestamps[i]}
              collapseState={collapsedStates[i]}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {selectedLines.size > 1 && (
          <div className="ELine-drag-overlay-badge">
            {selectedLines.size} lines
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
