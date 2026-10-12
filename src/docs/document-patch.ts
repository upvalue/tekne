import { z } from 'zod'
import { isEqual } from 'lodash-es'
import { zdoc, zline, type ZDoc, type ZLine } from './schema'

const id = zline.shape.id
export const documentPatchSchema = z.array(
  z.discriminatedUnion('op', [
    z.object({ op: z.literal('insert'), line: zline, after: id.nullable() }),
    z.object({ op: z.literal('update'), line: zline }),
    z.object({ op: z.literal('delete'), id }),
    z.object({ op: z.literal('move'), id, after: id.nullable() }),
  ])
)
export type DocumentPatch = z.infer<typeof documentPatchSchema>

type Entry = { line: ZLine; prev: string | null; next: string | null }

// Linked order keeps large inserts and reorders linear in the number of lines.
class Lines {
  entries = new Map<string, Entry>()
  head: string | null = null

  constructor(doc: ZDoc) {
    doc.children.forEach((line, index, lines) => {
      this.entries.set(line.id, {
        line,
        prev: lines[index - 1]?.id ?? null,
        next: lines[index + 1]?.id ?? null,
      })
    })
    this.head = doc.children[0]?.id ?? null
  }

  get(id: string): Entry {
    const entry = this.entries.get(id)
    if (!entry) throw new Error(`Unknown line: ${id}`)
    return entry
  }

  detach(id: string) {
    const entry = this.get(id)
    if (entry.prev === null) this.head = entry.next
    else this.get(entry.prev).next = entry.next
    if (entry.next !== null) this.get(entry.next).prev = entry.prev
  }

  place(line: ZLine, after: string | null) {
    if (line.id === after) throw new Error('A line cannot follow itself')
    const previous = after === null ? null : this.get(after)
    const next = previous ? previous.next : this.head
    this.entries.set(line.id, { line, prev: after, next })
    if (previous) previous.next = line.id
    else this.head = line.id
    if (next !== null) this.get(next).prev = line.id
  }

  apply(operation: DocumentPatch[number]) {
    switch (operation.op) {
      case 'insert':
        if (this.entries.has(operation.line.id))
          throw new Error('Duplicate line ID')
        this.place(operation.line, operation.after)
        break
      case 'update':
        this.get(operation.line.id).line = operation.line
        break
      case 'delete':
        this.detach(operation.id)
        this.entries.delete(operation.id)
        break
      case 'move': {
        if (operation.id === operation.after)
          throw new Error('A line cannot follow itself')
        if (operation.after !== null) this.get(operation.after)
        const line = this.get(operation.id).line
        this.detach(operation.id)
        this.place(line, operation.after)
      }
    }
  }

  values(): ZLine[] {
    const lines: ZLine[] = []
    let id = this.head
    while (id !== null) {
      const entry = this.get(id)
      lines.push(entry.line)
      id = entry.next
    }
    return lines
  }
}

export const diffDocuments = (before: ZDoc, after: ZDoc): DocumentPatch => {
  const lines = new Lines(before)
  const patch: DocumentPatch = []
  const emit = (operation: DocumentPatch[number]) => {
    patch.push(operation)
    lines.apply(operation)
  }
  const wanted = new Set(after.children.map((line) => line.id))
  for (const line of before.children) {
    if (!wanted.has(line.id)) emit({ op: 'delete', id: line.id })
  }
  let previous: string | null = null
  for (const line of after.children) {
    const existing = lines.entries.get(line.id)
    if (!existing) emit({ op: 'insert', line, after: previous })
    else {
      if (!isEqual(existing.line, line)) emit({ op: 'update', line })
      if (existing.prev !== previous)
        emit({ op: 'move', id: line.id, after: previous })
    }
    previous = line.id
  }
  return patch
}

export const applyDocumentPatch = (doc: ZDoc, patch: DocumentPatch): ZDoc => {
  const lines = new Lines(zdoc.parse(doc))
  for (const operation of documentPatchSchema.parse(patch))
    lines.apply(operation)
  return zdoc.parse({ ...doc, children: lines.values() })
}
