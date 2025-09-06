// schema.ts - schema definition and raw line operations (eg no external dependencies)
import { z } from 'zod'

const colorEnum = z.enum(['yellow', 'blue', 'purple', 'red', 'green'])

const zline = z.object({
  type: z.literal('line'),
  mdContent: z.string(),
  indent: z.number(),
  timeCreated: z.iso.datetime(),
  timeUpdated: z.iso.datetime(),
  collapsed: z.boolean().optional(),

  /**
   * Time recorded (in seconds)
   */
  datumTime: z.number().optional(),

  /**
   * Task completion status
   */
  datumTaskStatus: z.optional(z.enum(['complete', 'incomplete', 'unset'])),

  /**
   * Line background color
   */
  color: z.optional(colorEnum),
})

type ZLine = z.infer<typeof zline>

const zdoc = z.object({
  type: z.literal('doc'),
  schemaVersion: z.number(),
  children: z.array(zline),
})

type ZDoc = z.infer<typeof zdoc>

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const zdocTree = zdoc.extend({
  children: z.array(ztreeLine),
})

type ZDocTree = z.infer<typeof zdocTree>

export const tagPattern = /#[a-zA-Z0-9_-]+/g

const analyzeDoc = (doc: ZDoc): ZDocTree => {
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

const lineMake = (
  indent: number,
  mdContent: string = '',
  rest?: Partial<ZLine>
): ZLine => ({
  type: 'line',
  mdContent,
  indent,
  timeCreated: new Date().toISOString(),
  timeUpdated: new Date().toISOString(),
  ...(rest ? rest : {}),
})

const CURRENT_SCHEMA_VERSION = 1

const docMake = (children: ZLine[] = []): ZDoc => ({
  type: 'doc',
  schemaVersion: CURRENT_SCHEMA_VERSION,
  children,
})

export {
  zline,
  zdoc,
  analyzeDoc,
  lineMake,
  docMake,
  CURRENT_SCHEMA_VERSION,
  type ZLine,
  type ZDoc,
  type ZTreeLine as ZLineTree,
  type ZDocTree,
}

export type LineColor = z.infer<typeof colorEnum>
