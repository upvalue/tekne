// doc-analysis.ts - tree structure conversion and data analysis functions
import type { ZDoc, ZLine } from './schema'
import { TEKNE_MD_PARSER, visitMdTree } from './parser'

export type ZTreeLine = ZLine & {
  children: ZTreeLine[]
  tags: string[]
  arrayIdx: number
}

/**
 * For analysis purpose -- lines are converted into a tree struct
 * and information from mdContent is pulled out
 */
export type ZDocTree = Omit<ZDoc, 'children'> & { children: ZTreeLine[] }

/**
 * Converts document into a real tree structure
 */
export const treeifyDoc = (doc: ZDoc): ZDocTree => {
  const root: ZDocTree = {
    ...doc,
    children: [],
  }

  const stack: ZTreeLine[] = []
  for (let i = 0; i != doc.children.length; i++) {
    const node: ZTreeLine = {
      ...doc.children[i],
      children: [],
      tags: [],
      arrayIdx: i,
    }

    // Handle multiple matches

    const mdTree = TEKNE_MD_PARSER.parse(node.mdContent)
    visitMdTree(mdTree.topNode, node.mdContent, 0, (mdNode) => {
      if (mdNode.type.name === 'Tag') {
        node.tags.push(node.mdContent.slice(mdNode.from, mdNode.to))
      }
    })

    while (stack.length > node.indent) {
      stack.pop()
    }

    // Propagate tags from direct parent only (after stack is adjusted)
    if (stack.length > 0) {
      const parent = stack[stack.length - 1]
      node.tags.push(...parent.tags)
    }

    if (stack.length === 0) {
      root.children.push(node)
    } else {
      stack[stack.length - 1].children.push(node)
    }

    stack.push(node)
  }

  return root
}

type ZDocDatumType = 'task' | 'timer' | 'tag' | 'pin'

type ZDocDatum = {
  lineIdx: number
  timeCreated: string
  timeUpdated: string
  datumTag: string
  datumStatus?: ZLine['datumTaskStatus']
  datumTimeSeconds?: number
  datumPinnedAt?: string
  datumPinnedContent?: string
  datumType: ZDocDatumType
}
const makeDatum = (
  tag: string,
  tline: ZTreeLine,
  datumType: ZDocDatumType
): ZDocDatum => {
  return {
    lineIdx: tline.arrayIdx,
    timeCreated: tline.timeCreated,
    timeUpdated: tline.timeUpdated,
    datumTag: tag,
    datumType: datumType,
  }
}

const extractDocDataImpl = (ln: ZTreeLine, accum: Array<ZDocDatum>) => {
  for (const child of ln.children) {
    extractDocDataImpl(child, accum)
  }

  for (const tag of ln.tags) {
    if (ln.datumTaskStatus) {
      const datum = makeDatum(tag, ln, 'task')
      datum.datumStatus = ln.datumTaskStatus
      accum.push(datum)
    }

    if (ln.datumTimeSeconds) {
      const datum = makeDatum(tag, ln, 'timer')
      datum.datumTimeSeconds = ln.datumTimeSeconds
      accum.push(datum)
    }

    if (ln.datumPinnedAt) {
      const datum = makeDatum(tag, ln, 'pin')
      datum.datumPinnedAt = ln.datumPinnedAt
      datum.datumPinnedContent = ln.mdContent
      accum.push(datum)
    }

    const datum = makeDatum(tag, ln, 'tag')
    accum.push(datum)
  }
}

/**
 * Analyzes a document to discover any data, how it relates to tags,
 * and all tags present in a document
 */
export const extractDocData = (lines: Array<ZTreeLine>): Array<ZDocDatum> => {
  const ret: Array<ZDocDatum> = []
  for (const line of lines) {
    extractDocDataImpl(line, ret)
  }
  return ret
}
