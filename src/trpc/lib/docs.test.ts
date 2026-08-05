import { describe, test, expect } from 'vitest'
import { deriveNoteRows } from './docs'
import { docMake, lineMake } from '@/docs/schema'

describe('deriveNoteRows', () => {
  test('returns empty rows for an empty document', () => {
    const { parsedBody, noteData, noteLines } = deriveNoteRows(
      'Empty',
      docMake([])
    )

    expect(parsedBody).toEqual([])
    expect(noteData).toEqual([])
    expect(noteLines).toEqual([])
  })

  test('builds one parsed_body and one note_lines row per line', () => {
    const doc = docMake([
      lineMake(0, 'Parent'),
      lineMake(1, 'Child'),
      lineMake(1, 'Sibling'),
    ])

    const { parsedBody, noteLines } = deriveNoteRows('Doc', doc)

    expect(parsedBody.map((p) => p.line_idx)).toEqual([0, 1, 2])
    expect(parsedBody.every((p) => p.parsed_body != null)).toBe(true)

    expect(noteLines).toEqual([
      {
        note_title: 'Doc',
        line_idx: 0,
        content: 'Parent',
        indent: 0,
        time_created: new Date(doc.children[0].timeCreated),
        time_updated: new Date(doc.children[0].timeUpdated),
      },
      {
        note_title: 'Doc',
        line_idx: 1,
        content: 'Child',
        indent: 1,
        time_created: new Date(doc.children[1].timeCreated),
        time_updated: new Date(doc.children[1].timeUpdated),
      },
      {
        note_title: 'Doc',
        line_idx: 2,
        content: 'Sibling',
        indent: 1,
        time_created: new Date(doc.children[2].timeCreated),
        time_updated: new Date(doc.children[2].timeUpdated),
      },
    ])
  })

  test('extracts a note_data row per tag, keyed to its line', () => {
    const doc = docMake([
      lineMake(0, 'untagged line'),
      lineMake(0, 'tagged line #work'),
    ])

    const { noteData } = deriveNoteRows('Doc', doc)

    expect(noteData).toHaveLength(1)
    expect(noteData[0]).toMatchObject({
      note_title: 'Doc',
      line_idx: 1,
      datum_tag: '#work',
    })
  })

  test('reads the document it is given rather than a rebuilt one', () => {
    // linesToZodDoc used to rebuild the doc with a hardcoded schemaVersion of
    // 1 before analysis, so a doc at any other version was silently analyzed
    // as v1. Nothing branches on the version yet -- this pins the plumbing so
    // it stays that way when something does.
    const doc = { ...docMake([lineMake(0, 'line #tag')]), schemaVersion: 99 }

    const { noteData } = deriveNoteRows('Doc', doc)

    expect(noteData).toHaveLength(1)
    expect(noteData[0].datum_tag).toBe('#tag')
  })
})
