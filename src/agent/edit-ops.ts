// edit-ops.ts - The agent's edit operations against an outline document.
//
// Operations address lines by their stable id (`timeCreated`) and apply
// sequentially to a draft copy of the document. Failures are per-op results
// (fed back to the model as tool output), never exceptions.

import { Type, type Static } from '@earendil-works/pi-ai'
import { lineMake, lineTimestampMake, type ZDoc } from '@/docs/schema'

const insertedLine = Type.Object({
  mdContent: Type.String({ description: 'Markdown text for the new line' }),
  indent: Type.Integer({
    minimum: 0,
    description: 'Indent level of the new line',
  }),
})

export const EditToolParams = Type.Object({
  ops: Type.Array(
    Type.Union([
      Type.Object({
        op: Type.Literal('replace'),
        id: Type.String({ description: 'id of the line to rewrite' }),
        mdContent: Type.String({ description: 'New markdown text' }),
      }),
      Type.Object({
        op: Type.Literal('set_indent'),
        id: Type.String({ description: 'id of the line to re-indent' }),
        indent: Type.Integer({ minimum: 0, description: 'New indent level' }),
      }),
      Type.Object({
        op: Type.Literal('delete'),
        id: Type.String({ description: 'id of the line to delete' }),
      }),
      Type.Object({
        op: Type.Literal('insert_after'),
        id: Type.Union([Type.String(), Type.Null()], {
          description:
            'id of the line to insert after, or null to insert at the top of the document',
        }),
        lines: Type.Array(insertedLine, {
          minItems: 1,
          description: 'New lines, in order',
        }),
      }),
    ]),
    { description: 'Operations to apply, in order' }
  ),
})

export type EditOp = Static<typeof EditToolParams>['ops'][number]

export type OpResult = { ok: true } | { ok: false; error: string }

const findLine = (doc: ZDoc, id: string): number =>
  doc.children.findIndex((line) => line.timeCreated === id)

/**
 * Applies `ops` in order to a copy of `doc`. Each op sees the result of the
 * previous one. Ops referencing unknown ids fail individually; the rest
 * still apply.
 */
export const applyEditOps = (
  doc: ZDoc,
  ops: EditOp[]
): { doc: ZDoc; results: OpResult[] } => {
  const children = [...doc.children]
  const results: OpResult[] = []

  for (const op of ops) {
    if (op.op === 'insert_after') {
      let at = 0
      if (op.id !== null) {
        const idx = findLine({ ...doc, children }, op.id)
        if (idx === -1) {
          results.push({ ok: false, error: `no line with id ${op.id}` })
          continue
        }
        at = idx + 1
      }
      children.splice(
        at,
        0,
        ...op.lines.map((line) => lineMake(line.indent, line.mdContent))
      )
      results.push({ ok: true })
      continue
    }

    const idx = findLine({ ...doc, children }, op.id)
    if (idx === -1) {
      results.push({ ok: false, error: `no line with id ${op.id}` })
      continue
    }

    if (op.op === 'replace') {
      children[idx] = {
        ...children[idx],
        mdContent: op.mdContent,
        timeUpdated: lineTimestampMake(),
      }
    } else if (op.op === 'set_indent') {
      children[idx] = {
        ...children[idx],
        indent: op.indent,
        timeUpdated: lineTimestampMake(),
      }
    } else {
      children.splice(idx, 1)
    }
    results.push({ ok: true })
  }

  return { doc: { ...doc, children }, results }
}

/** Tool-result text the model reads after an edit call. */
export const summarizeOpResults = (results: OpResult[]): string => {
  const failures = results
    .map((result, idx) => ({ result, idx }))
    .filter(({ result }) => !result.ok)
  if (failures.length === 0) {
    return `Applied ${results.length} operation${results.length === 1 ? '' : 's'}.`
  }
  const lines = failures.map(
    ({ result, idx }) =>
      `op ${idx + 1} failed: ${result.ok ? '' : result.error}`
  )
  return `Applied ${results.length - failures.length} of ${results.length} operations.\n${lines.join('\n')}`
}
