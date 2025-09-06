// doc-analysis.ts - tree structure conversion and data analysis functions
import { z } from 'zod'
import { zline, zdoc, type ZDoc, type ZLine } from './schema'

export type ZTreeLine = ZLine & {
  children: ZTreeLine[]
  tags: string[]
  arrayIdx: number
}

/**
 * For analysis purpose -- lines are converted into a tree struct
 * and information from mdContent is pulled out
 */
const ztreeLine: z.ZodType<ZTreeLine> = zline.extend({
  children: z.array(z.lazy(() => ztreeLine)),
  tags: z.array(z.string()),
  // Index of the line in the original document
  arrayIdx: z.number(),
})

const zdocTree = zdoc.extend({
  children: z.array(ztreeLine),
})

export type ZDocTree = z.infer<typeof zdocTree>

// TODO: Centralize this regex
export const tagPattern = /#[a-zA-Z0-9_-]+/g

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
    const matches = node.mdContent.match(tagPattern)
    if (matches) {
      node.tags.push(...matches)
    }

    while (stack.length > node.indent) {
      stack.pop()
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

/*
const extractDocData = (doc: ZDocTree) => {

}*/
