import { useRef, useMemo } from 'react'

import './TEditor.css'

import { useAtom } from 'jotai'

import { useCodemirrorEvent } from './line-editor'
import { docAtom } from './state'
import { generateGutterTimestamps } from '@/docs/gutters'
import { generateCollapse } from '@/docs/collapse'
import { ELine } from './ELine'

/**
 * The top level editor component.
 */
export const TEditor = () => {
  const [doc] = useAtom(docAtom)
  const containerRef = useRef<HTMLDivElement>(null)

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

  useCodemirrorEvent('tagClick', (event) => {
    console.log('Tag clicked', event.name)
  })

  return (
    <div ref={containerRef} className="max-h-[88vh] overflow-y-auto pb-32">
      {doc.children.map((l, i) => (
        <ELine
          key={i}
          line={l}
          lineIdx={i}
          timestamp={gutterTimestamps[i]}
          collapseState={collapsedStates[i]}
        />
      ))}
    </div>
  )
}
