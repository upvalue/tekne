import { describe, test, expect } from 'vitest'
import { analyzeDoc, lineMake, docMake, type ZDoc } from './schema'

describe('analyzeDoc', () => {
  test('should handle empty document', () => {
    const doc: ZDoc = docMake([])

    const result = analyzeDoc(doc)

    expect(result).toEqual({
      type: 'doc',
      schemaVersion: 1,
      children: [],
    })
  })

  test('should handle flat structure with no indentation', () => {
    const doc: ZDoc = docMake([
      { ...lineMake(0, 'First line') },
      { ...lineMake(0, 'Second line') },
      { ...lineMake(0, 'Third line') },
    ])

    const result = analyzeDoc(doc)

    expect(result.children).toHaveLength(3)
    expect(result.children[0]).toEqual({
      ...doc.children[0],
      arrayIdx: 0,
      children: [],
      tags: [],
    })
    expect(result.children[1]).toEqual({
      ...doc.children[1],
      arrayIdx: 1,
      children: [],
      tags: [],
    })
    expect(result.children[2]).toEqual({
      ...doc.children[2],
      arrayIdx: 2,
      children: [],
      tags: [],
    })
  })

  test('should handle simple nested structure', () => {
    const doc: ZDoc = docMake([
      { ...lineMake(0, 'Parent 1') },
      { ...lineMake(1, 'Child 1.1') },
      { ...lineMake(1, 'Child 1.2') },
      { ...lineMake(0, 'Parent 2') },
    ])

    const result = analyzeDoc(doc)

    expect(result.children).toHaveLength(2)

    // First parent
    expect(result.children[0].mdContent).toBe('Parent 1')
    expect(result.children[0].children).toHaveLength(2)
    expect(result.children[0].children[0].mdContent).toBe('Child 1.1')
    expect(result.children[0].children[1].mdContent).toBe('Child 1.2')

    // Second parent
    expect(result.children[1].mdContent).toBe('Parent 2')
    expect(result.children[1].children).toHaveLength(0)
  })

  test('should handle deeply nested structure', () => {
    const doc: ZDoc = docMake([
      { ...lineMake(0, 'Level 0') },
      { ...lineMake(1, 'Level 1') },
      { ...lineMake(2, 'Level 2') },
      { ...lineMake(3, 'Level 3') },
      { ...lineMake(1, 'Back to Level 1') },
    ])

    const result = analyzeDoc(doc)

    expect(result.children).toHaveLength(1)

    const level0 = result.children[0]
    expect(level0.mdContent).toBe('Level 0')
    expect(level0.children).toHaveLength(2)

    const level1_1 = level0.children[0]
    expect(level1_1.mdContent).toBe('Level 1')
    expect(level1_1.children).toHaveLength(1)

    const level2 = level1_1.children[0]
    expect(level2.mdContent).toBe('Level 2')
    expect(level2.children).toHaveLength(1)

    const level3 = level2.children[0]
    expect(level3.mdContent).toBe('Level 3')
    expect(level3.children).toHaveLength(0)

    const level1_2 = level0.children[1]
    expect(level1_2.mdContent).toBe('Back to Level 1')
    expect(level1_2.children).toHaveLength(0)
  })

  test('should handle mixed indentation levels', () => {
    const doc: ZDoc = docMake([
      { ...lineMake(0, 'Root 1') },
      { ...lineMake(1, 'Child 1.1') },
      { ...lineMake(2, 'Grandchild 1.1.1') },
      { ...lineMake(0, 'Root 2') },
      { ...lineMake(1, 'Child 2.1') },
      { ...lineMake(1, 'Child 2.2') },
      { ...lineMake(2, 'Grandchild 2.2.1') },
      { ...lineMake(2, 'Grandchild 2.2.2') },
    ])

    const result = analyzeDoc(doc)

    expect(result.children).toHaveLength(2)

    // Root 1 structure
    const root1 = result.children[0]
    expect(root1.mdContent).toBe('Root 1')
    expect(root1.children).toHaveLength(1)
    expect(root1.children[0].mdContent).toBe('Child 1.1')
    expect(root1.children[0].children).toHaveLength(1)
    expect(root1.children[0].children[0].mdContent).toBe('Grandchild 1.1.1')

    // Root 2 structure
    const root2 = result.children[1]
    expect(root2.mdContent).toBe('Root 2')
    expect(root2.children).toHaveLength(2)
    expect(root2.children[0].mdContent).toBe('Child 2.1')
    expect(root2.children[0].children).toHaveLength(0)
    expect(root2.children[1].mdContent).toBe('Child 2.2')
    expect(root2.children[1].children).toHaveLength(2)
    expect(root2.children[1].children[0].mdContent).toBe('Grandchild 2.2.1')
    expect(root2.children[1].children[1].mdContent).toBe('Grandchild 2.2.2')
  })

  test('should handle single line document', () => {
    const line = lineMake(0, 'Only line')
    const doc: ZDoc = docMake([line])

    const result = analyzeDoc(doc)

    expect(result.children).toHaveLength(1)
    expect(result.children[0]).toEqual({
      ...line,
      arrayIdx: 0,
      children: [],
      tags: [],
    })
  })

  test('should preserve original line properties', () => {
    const doc: ZDoc = docMake([
      {
        ...lineMake(0, 'Task line'),
        datumTaskStatus: 'incomplete',
      },
      {
        ...lineMake(1, 'Child task'),
        datumTaskStatus: 'complete',
      },
    ])

    const result = analyzeDoc(doc)

    expect(result.children).toHaveLength(1)
    expect(result.children[0].datumTaskStatus).toBe('incomplete')
    expect(result.children[0].children).toHaveLength(1)
    expect(result.children[0].children[0].datumTaskStatus).toBe('complete')
  })

  test('should handle skipped indentation levels', () => {
    const doc: ZDoc = docMake([
      { ...lineMake(0, 'Level 0') },
      { ...lineMake(2, 'Level 2 (skipped 1)') },
      { ...lineMake(1, 'Level 1') },
    ])

    const result = analyzeDoc(doc)

    expect(result.children).toHaveLength(1)

    const level0 = result.children[0]
    expect(level0.mdContent).toBe('Level 0')
    expect(level0.children).toHaveLength(2)

    // The skipped level should still work
    expect(level0.children[0].mdContent).toBe('Level 2 (skipped 1)')
    expect(level0.children[1].mdContent).toBe('Level 1')
  })

  test('should initialize tags and children arrays for all lines', () => {
    const doc: ZDoc = docMake([
      { ...lineMake(0, 'Line 1') },
      { ...lineMake(1, 'Line 2') },
    ])

    const result = analyzeDoc(doc)

    // Check that all lines have empty tags and children arrays
    expect(result.children[0].tags).toEqual([])
    expect(result.children[0].children).toEqual(expect.any(Array))
    expect(result.children[0].children[0].tags).toEqual([])
    expect(result.children[0].children[0].children).toEqual([])
  })
})
