import { describe, test, expect } from 'vitest'
import {
  computeRenamePairs,
  findChildTags,
  rewriteLineTags,
  rewriteDocTags,
} from '@/docs/tag-rename'
import { docMake, lineMake } from '@/docs/schema'

const pairs = (...entries: Array<[string, string]>) => new Map(entries)

describe('computeRenamePairs', () => {
  test('maps only the tag itself without children', () => {
    const result = computeRenamePairs(
      'proj',
      'work',
      ['proj', 'proj/tekne', 'projx'],
      false
    )
    expect(result).toEqual(pairs(['proj', 'work']))
  })

  test('includes hierarchical children when requested', () => {
    const result = computeRenamePairs(
      'proj',
      'work',
      ['proj', 'proj/tekne', 'proj/a/b', 'projx', 'other'],
      true
    )
    expect(result).toEqual(
      pairs(
        ['proj', 'work'],
        ['proj/tekne', 'work/tekne'],
        ['proj/a/b', 'work/a/b']
      )
    )
  })

  test('does not treat shared prefixes as children', () => {
    const result = computeRenamePairs('proj', 'work', ['projx/y'], true)
    expect(result).toEqual(pairs(['proj', 'work']))
  })
})

describe('findChildTags', () => {
  test('finds strict prefix children only', () => {
    expect(
      findChildTags('proj', ['proj', 'proj/tekne', 'proj/a/b', 'projx/y'])
    ).toEqual(['proj/a/b', 'proj/tekne'])
  })
})

describe('rewriteLineTags', () => {
  test('renames a tag mid-line', () => {
    expect(rewriteLineTags('do stuff #proj today', pairs(['proj', 'work']))).toBe(
      'do stuff #work today'
    )
  })

  test('renames a tag at end of line', () => {
    expect(rewriteLineTags('do stuff #proj', pairs(['proj', 'work']))).toBe(
      'do stuff #work'
    )
  })

  test('renames multiple occurrences on one line', () => {
    expect(rewriteLineTags('#proj and #proj', pairs(['proj', 'work']))).toBe(
      '#work and #work'
    )
  })

  test('handles renames that change tag length', () => {
    expect(
      rewriteLineTags('#a mid #a end', pairs(['a', 'something-longer']))
    ).toBe('#something-longer mid #something-longer end')
  })

  test('returns null for unchanged lines', () => {
    expect(rewriteLineTags('no tags here', pairs(['proj', 'work']))).toBeNull()
    expect(rewriteLineTags('other #tag', pairs(['proj', 'work']))).toBeNull()
  })

  test('does not touch tags that merely share a prefix', () => {
    expect(rewriteLineTags('#projx stays', pairs(['proj', 'work']))).toBeNull()
    expect(
      rewriteLineTags('#proj/tekne stays', pairs(['proj', 'work']))
    ).toBeNull()
  })

  test('does not touch non-tag text that looks like a tag', () => {
    // Trailing punctuation means the parser does not recognize a tag
    expect(rewriteLineTags('#proj, not a tag', pairs(['proj', 'work']))).toBeNull()
  })

  test('renames children when included in pairs', () => {
    expect(
      rewriteLineTags(
        '#proj and #proj/tekne',
        pairs(['proj', 'work'], ['proj/tekne', 'work/tekne'])
      )
    ).toBe('#work and #work/tekne')
  })

  describe('merge dedupe', () => {
    test('removes renamed tag when target follows it', () => {
      expect(rewriteLineTags('#a #b done', pairs(['a', 'b']))).toBe('#b done')
    })

    test('removes renamed tag when target precedes it', () => {
      expect(rewriteLineTags('#b #a done', pairs(['a', 'b']))).toBe('#b done')
    })

    test('dedupes when the renamed tag ends the line', () => {
      expect(rewriteLineTags('done #b #a', pairs(['a', 'b']))).toBe('done #b')
    })

    test('preserves duplicates the user already had', () => {
      expect(rewriteLineTags('#a then #a', pairs(['a', 'b']))).toBe(
        '#b then #b'
      )
    })

    test('dedupes when two different tags merge into the same target', () => {
      expect(
        rewriteLineTags('#x and #y', pairs(['x', 'z'], ['y', 'z']))
      ).toBe('#z and')
    })

    test('dedupes with text between tags', () => {
      expect(rewriteLineTags('#a some text #b', pairs(['a', 'b']))).toBe(
        'some text #b'
      )
    })

    test('leaves no double spaces behind', () => {
      expect(rewriteLineTags('x #a y #b z', pairs(['a', 'b']))).toBe('x y #b z')
    })
  })
})

describe('rewriteDocTags', () => {
  test('rewrites only affected lines and reports them', () => {
    const doc = docMake([
      lineMake(0, 'plain line'),
      lineMake(0, 'work on #proj'),
      lineMake(1, 'child of #proj/tekne'),
    ])

    const { newDoc, changedLines } = rewriteDocTags(doc, pairs(['proj', 'work']))

    expect(changedLines).toEqual([
      { lineIdx: 1, before: 'work on #proj', after: 'work on #work' },
    ])
    expect(newDoc.children[0].mdContent).toBe('plain line')
    expect(newDoc.children[1].mdContent).toBe('work on #work')
    expect(newDoc.children[2].mdContent).toBe('child of #proj/tekne')
  })

  test('does not modify line timestamps or the original doc', () => {
    const doc = docMake([lineMake(0, '#proj task')])
    const { newDoc } = rewriteDocTags(doc, pairs(['proj', 'work']))

    expect(doc.children[0].mdContent).toBe('#proj task')
    expect(newDoc.children[0].timeCreated).toBe(doc.children[0].timeCreated)
    expect(newDoc.children[0].timeUpdated).toBe(doc.children[0].timeUpdated)
  })

  test('reports no changes when nothing matches', () => {
    const doc = docMake([lineMake(0, 'nothing to do')])
    const { newDoc, changedLines } = rewriteDocTags(doc, pairs(['proj', 'work']))
    expect(changedLines).toEqual([])
    expect(newDoc).toEqual(doc)
  })
})
