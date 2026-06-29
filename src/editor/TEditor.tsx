import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  type SortingStrategy,
} from '@dnd-kit/sortable'
import { useAtom, useSetAtom } from 'jotai'

import { useCodemirrorEvent } from './line-editor'
import {
  docAtom,
  dragSelectedLineIdsAtom,
  dragSelectionAnchorIdAtom,
  requestFocusLineAtom,
} from './state'
import { generateGutterTimestamps } from '@/docs/gutters'
import { generateCollapse } from '@/docs/collapse'
import { ELine } from './ELine'
import {
  findLineIndexById,
  getVisibleLineIds,
  normalizeSelectedLineIds,
  selectOutlineBlock,
  selectOutlineRange,
  toggleOutlineBlockSelection,
} from './outline-selection'
import { moveSelectedLines, type DropEdge } from './line-reorder'

type DropIntent = {
  targetId: string
  edge: DropEdge
}

const DOC_START_DROP_ID = '__tekne-doc-start__'
const DOC_END_DROP_ID = '__tekne-doc-end__'

const lineIdFromDndId = (id: UniqueIdentifier | null | undefined) =>
  id === null || id === undefined ? null : String(id)

const getDropEdge = (event: DragOverEvent | DragEndEvent): DropEdge | null => {
  if (!event.over) return null

  const translatedRect = event.active.rect.current.translated
  const initialRect = event.active.rect.current.initial
  const activeCenterY = translatedRect
    ? translatedRect.top + translatedRect.height / 2
    : initialRect
      ? initialRect.top + event.delta.y + initialRect.height / 2
      : event.over.rect.top + event.over.rect.height / 2

  return activeCenterY < event.over.rect.top + event.over.rect.height / 2
    ? 'before'
    : 'after'
}

const noLineDisplacementStrategy: SortingStrategy = () => null

const resolveDropTarget = (
  overId: string | null,
  edge: DropEdge | null,
  visibleLineIds: string[]
) => {
  if (overId === DOC_START_DROP_ID) {
    const firstVisibleLineId = visibleLineIds[0]
    return firstVisibleLineId
      ? { targetId: firstVisibleLineId, edge: 'before' as const }
      : null
  }

  if (overId === DOC_END_DROP_ID) {
    const lastVisibleLineId = visibleLineIds[visibleLineIds.length - 1]
    return lastVisibleLineId
      ? { targetId: lastVisibleLineId, edge: 'after' as const }
      : null
  }

  if (!overId || !edge) return null
  return { targetId: overId, edge }
}

const EditorBoundaryDropZone = ({
  id,
  isLineDragActive,
}: {
  id: string
  isLineDragActive: boolean
}) => {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`TEditor-boundary-drop-zone ${
        isLineDragActive ? 'TEditor-boundary-drop-zone-active' : ''
      } ${isOver ? 'TEditor-boundary-drop-zone-over' : ''}`}
    />
  )
}

/**
 * The top level editor component.
 */
export const TEditor = () => {
  const [doc, setDoc] = useAtom(docAtom)
  const [dragSelectedLineIds, setDragSelectedLineIds] = useAtom(
    dragSelectedLineIdsAtom
  )
  const [dragSelectionAnchorId, setDragSelectionAnchorId] = useAtom(
    dragSelectionAnchorIdAtom
  )
  const setRequestFocusLine = useSetAtom(requestFocusLineAtom)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragSelectedLineIdsRef = useRef(dragSelectedLineIds)
  const [activeDragLineId, setActiveDragLineId] = useState<string | null>(null)
  const [dropIntent, setDropIntent] = useState<DropIntent | null>(null)
  const [isLineDragActive, setIsLineDragActive] = useState(false)

  useEffect(() => {
    dragSelectedLineIdsRef.current = dragSelectedLineIds
  }, [dragSelectedLineIds])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
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

  const visibleLineIds = useMemo(() => {
    return getVisibleLineIds(doc.children, collapsedStates)
  }, [collapsedStates, doc.children])

  useCodemirrorEvent('tagClick', (event) => {
    console.log('Tag clicked', event.name)
  })

  const clearDragSelection = useCallback(() => {
    dragSelectedLineIdsRef.current = []
    setDragSelectedLineIds([])
    setDragSelectionAnchorId(null)
  }, [setDragSelectedLineIds, setDragSelectionAnchorId])

  const ensureSelectionForActiveLine = useCallback(
    (activeLineId: string) => {
      const currentSelection = dragSelectedLineIdsRef.current
      if (currentSelection.includes(activeLineId)) return currentSelection

      const activeLineIdx = findLineIndexById(doc.children, activeLineId)
      if (activeLineIdx === -1) return currentSelection

      const nextSelection = selectOutlineBlock(doc.children, activeLineIdx)
      dragSelectedLineIdsRef.current = nextSelection
      setDragSelectedLineIds(nextSelection)
      setDragSelectionAnchorId(activeLineId)
      return nextSelection
    },
    [doc.children, setDragSelectedLineIds, setDragSelectionAnchorId]
  )

  const handleDragHandleClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, lineIdx: number) => {
      event.preventDefault()
      event.stopPropagation()

      const line = doc.children[lineIdx]
      if (!line) return

      const lineId = line.timeCreated
      let nextSelection: string[]
      const currentSelection = dragSelectedLineIdsRef.current

      if (event.shiftKey && dragSelectionAnchorId) {
        nextSelection = selectOutlineRange(
          doc.children,
          dragSelectionAnchorId,
          lineId
        )
      } else if (event.metaKey || event.ctrlKey) {
        nextSelection = toggleOutlineBlockSelection(
          doc.children,
          currentSelection,
          lineIdx
        )
        setDragSelectionAnchorId(nextSelection.length > 0 ? lineId : null)
      } else if (currentSelection.includes(lineId)) {
        clearDragSelection()
        return
      } else {
        nextSelection = selectOutlineBlock(doc.children, lineIdx)
        setDragSelectionAnchorId(lineId)
      }

      dragSelectedLineIdsRef.current = nextSelection
      setDragSelectedLineIds(nextSelection)
    },
    [
      clearDragSelection,
      doc.children,
      dragSelectionAnchorId,
      setDragSelectedLineIds,
      setDragSelectionAnchorId,
    ]
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const activeLineId = lineIdFromDndId(event.active.id)
      if (!activeLineId) return

      setIsLineDragActive(true)
      setActiveDragLineId(activeLineId)
      ensureSelectionForActiveLine(activeLineId)
    },
    [ensureSelectionForActiveLine]
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const overId = lineIdFromDndId(event.over?.id)
      const dropTarget = resolveDropTarget(
        overId,
        getDropEdge(event),
        visibleLineIds
      )

      if (
        !dropTarget ||
        (overId !== DOC_START_DROP_ID &&
          overId !== DOC_END_DROP_ID &&
          dragSelectedLineIdsRef.current.includes(dropTarget.targetId))
      ) {
        setDropIntent(null)
        return
      }

      setDropIntent(dropTarget)
    },
    [visibleLineIds]
  )

  const clearDragState = useCallback(() => {
    setActiveDragLineId(null)
    setDropIntent(null)
    setIsLineDragActive(false)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeLineId = lineIdFromDndId(event.active.id)
      const overId = lineIdFromDndId(event.over?.id)
      const dropTarget =
        dropIntent ??
        resolveDropTarget(overId, getDropEdge(event), visibleLineIds)

      if (!activeLineId || !dropTarget) {
        clearDragState()
        return
      }

      const selectedLineIds = ensureSelectionForActiveLine(activeLineId)
      const result = moveSelectedLines({
        lines: doc.children,
        selectedLineIds,
        targetId: dropTarget.targetId,
        edge: dropTarget.edge,
        touchedLineId: activeLineId,
        now: new Date().toISOString(),
      })

      if (result.moved) {
        const nextSelection = normalizeSelectedLineIds(
          result.lines,
          selectedLineIds
        )
        dragSelectedLineIdsRef.current = nextSelection
        setDragSelectedLineIds(nextSelection)

        setDoc((draft) => {
          draft.children = result.lines
        })

        const focusedLineIdx = findLineIndexById(result.lines, activeLineId)
        if (focusedLineIdx !== -1) {
          setRequestFocusLine({
            lineIdx: focusedLineIdx,
            pos: result.lines[focusedLineIdx].mdContent.length,
          })
        }
      }

      clearDragState()
    },
    [
      clearDragState,
      doc.children,
      dropIntent,
      ensureSelectionForActiveLine,
      setDoc,
      setDragSelectedLineIds,
      setRequestFocusLine,
      visibleLineIds,
    ]
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={clearDragState}
    >
      <SortableContext
        items={visibleLineIds}
        strategy={noLineDisplacementStrategy}
      >
        <div
          ref={containerRef}
          className={`max-h-[88vh] overflow-y-auto pb-32 ${
            dragSelectedLineIds.length > 0 ? 'TEditor-has-drag-selection' : ''
          }`}
        >
          <EditorBoundaryDropZone
            id={DOC_START_DROP_ID}
            isLineDragActive={isLineDragActive}
          />
          {doc.children.map((l, i) => (
            <ELine
              key={l.timeCreated}
              line={l}
              lineIdx={i}
              timestamp={gutterTimestamps[i]}
              collapseState={collapsedStates[i]}
              isDragSelected={dragSelectedLineIds.includes(l.timeCreated)}
              isActiveDragLine={activeDragLineId === l.timeCreated}
              dropEdge={
                dropIntent?.targetId === l.timeCreated ? dropIntent.edge : null
              }
              disableTimestampHover={isLineDragActive}
              onDragHandleClick={handleDragHandleClick}
              onEditorInteract={clearDragSelection}
            />
          ))}
          <EditorBoundaryDropZone
            id={DOC_END_DROP_ID}
            isLineDragActive={isLineDragActive}
          />
        </div>
      </SortableContext>
    </DndContext>
  )
}
