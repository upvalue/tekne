import { z } from 'zod'
import { zdoc, zline, type ZDoc, type ZLine } from './schema'
import { lineIdMake } from './line-identity'

const fields = zline.pick({
  mdContent: true,
  indent: true,
  collapsed: true,
  datumTimeSeconds: true,
  datumTaskStatus: true,
  datumPinnedAt: true,
})
const changes = fields
  .partial()
  .extend({
    collapsed: z.boolean().nullable().optional(),
    datumTimeSeconds: z.number().nonnegative().nullable().optional(),
    datumTaskStatus: zline.shape.datumTaskStatus.unwrap().nullable().optional(),
    datumPinnedAt: zline.shape.datumPinnedAt.unwrap().nullable().optional(),
  })
  .strict()
const id = zline.shape.id
const scope = z.enum(['line', 'subtree'])
export const documentEditSchema = z
  .array(
    z.discriminatedUnion('op', [
      z.object({ op: z.literal('update'), id, changes }).strict(),
      z
        .object({
          op: z.literal('insert'),
          after: id.nullable(),
          lines: fields
            .extend({ datumTimeSeconds: z.number().nonnegative().optional() })
            .strict()
            .array()
            .min(1)
            .max(1000),
        })
        .strict(),
      z.object({ op: z.literal('delete'), id, scope }).strict(),
      z
        .object({
          op: z.literal('move'),
          id,
          scope,
          after: id.nullable(),
          indent: z.number().int().nonnegative(),
        })
        .strict(),
    ])
  )
  .min(1)
  .max(1000)
  .refine(
    (operations) =>
      operations.reduce(
        (count, op) => count + (op.op === 'insert' ? op.lines.length : 0),
        0
      ) <= 1000,
    'At most 1000 inserted lines per batch'
  )

export type DocumentEdit = z.infer<typeof documentEditSchema>
export type InsertedLine = {
  operationIndex: number
  lineIndex: number
  id: string
}

/** Operations see earlier changes in the batch. Failure leaves the input untouched. */
export function applyDocumentEdit(
  source: ZDoc,
  operations: DocumentEdit,
  factories = { id: lineIdMake, now: () => new Date().toISOString() }
): { doc: ZDoc; insertedLines: InsertedLine[] } {
  const doc = zdoc.parse(source)
  const insertedLines: InsertedLine[] = []
  const now = factories.now()
  const find = (id: string) => {
    const index = doc.children.findIndex((line) => line.id === id)
    if (index < 0) throw new Error(`Unknown line: ${id}`)
    return index
  }
  const afterIndex = (id: string | null) => (id === null ? 0 : find(id) + 1)
  documentEditSchema.parse(operations).forEach((op, operationIndex) => {
    if (op.op === 'insert') {
      const at = afterIndex(op.after)
      const lines = op.lines.map((fields, lineIndex): ZLine => {
        const id = factories.id()
        insertedLines.push({ operationIndex, lineIndex, id })
        return {
          ...fields,
          type: 'line',
          id,
          timeCreated: now,
          timeUpdated: now,
        }
      })
      doc.children.splice(at, 0, ...lines)
      return
    }
    const start = find(op.id)
    const line = doc.children[start]
    if (op.op === 'update') {
      const updated = { ...line, ...op.changes, timeUpdated: now }
      for (const key of [
        'collapsed',
        'datumTimeSeconds',
        'datumTaskStatus',
        'datumPinnedAt',
      ] as const) {
        if (updated[key] === null) delete updated[key]
      }
      doc.children[start] = zline.parse(updated)
      return
    }
    let end = start + 1
    if (op.scope === 'subtree') {
      while (
        end < doc.children.length &&
        doc.children[end].indent > line.indent
      )
        end++
    }
    if (op.op === 'delete') {
      doc.children.splice(start, end - start)
      return
    }
    if (op.after !== null) {
      const anchor = find(op.after)
      if (anchor >= start && anchor < end)
        throw new Error('Move anchor is inside the moved lines')
    }
    const delta = op.indent - line.indent
    const moved = doc.children.splice(start, end - start).map((child) => ({
      ...child,
      indent: child.indent + delta,
      timeUpdated: now,
    }))
    doc.children.splice(afterIndex(op.after), 0, ...moved)
  })
  return { doc: zdoc.parse(doc), insertedLines }
}
