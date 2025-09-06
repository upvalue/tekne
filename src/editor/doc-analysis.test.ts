import { describe, test, expect } from 'vitest'
import { treeifyDoc } from './doc-analysis'
import { lineMake, docMake, type ZDoc } from './schema'

describe('treeifyDoc', () => {
  test('should handle empty document', () => {
    const doc: ZDoc = docMake([])

    const result = treeifyDoc(doc)

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

    const result = treeifyDoc(doc)

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

    const result = treeifyDoc(doc)

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

    const result = treeifyDoc(doc)

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

    const result = treeifyDoc(doc)

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

    const result = treeifyDoc(doc)

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

    const result = treeifyDoc(doc)

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

    const result = treeifyDoc(doc)

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

    const result = treeifyDoc(doc)

    // Check that all lines have empty tags and children arrays
    expect(result.children[0].tags).toEqual([])
    expect(result.children[0].children).toEqual(expect.any(Array))
    expect(result.children[0].children[0].tags).toEqual([])
    expect(result.children[0].children[0].children).toEqual([])
  })

  test('should extract tags from mdContent', () => {
    const doc: ZDoc = docMake([
      { ...lineMake(0, 'Parent with #tag1') },
      { ...lineMake(0, 'Another line with #tag2 and #tag3') },
    ])

    const result = treeifyDoc(doc)

    expect(result.children[0].tags).toEqual(['#tag1'])
    expect(result.children[1].tags).toEqual(['#tag2', '#tag3'])
  })

  test('should propagate tags from parent to direct children only', () => {
    const doc: ZDoc = docMake([
      { ...lineMake(0, 'Parent with #tag1') },
      { ...lineMake(1, 'Child of parent') },
      { ...lineMake(2, 'Grandchild #tag2') },
      { ...lineMake(0, 'Another parent #tag3') },
      { ...lineMake(1, 'Child of second parent') },
    ])

    const result = treeifyDoc(doc)

    // Parent node should have its own tag
    expect(result.children[0].tags).toEqual(['#tag1'])
    
    // Direct child should inherit parent's tags
    expect(result.children[0].children[0].tags).toEqual(['#tag1'])
    
    // Grandchild should inherit parent's tags plus its own
    expect(result.children[0].children[0].children[0].tags).toEqual(['#tag2', '#tag1'])
    
    // Second parent should have its own tag
    expect(result.children[1].tags).toEqual(['#tag3'])
    
    // Child of second parent should inherit second parent's tags
    expect(result.children[1].children[0].tags).toEqual(['#tag3'])
  })

  test('should not propagate tags to siblings', () => {
    const doc: ZDoc = docMake([
      { ...lineMake(0, 'First sibling #tag1') },
      { ...lineMake(0, 'Second sibling') },
      { ...lineMake(1, 'Child of second sibling') },
    ])

    const result = treeifyDoc(doc)

    expect(result.children[0].tags).toEqual(['#tag1'])
    expect(result.children[1].tags).toEqual([])
    expect(result.children[1].children[0].tags).toEqual([])
  })

  test('should handle multiple tags on same node with propagation', () => {
    const doc: ZDoc = docMake([
      { ...lineMake(0, 'Parent with #tag1 and #tag2') },
      { ...lineMake(1, 'Child with #tag3') },
    ])

    const result = treeifyDoc(doc)

    expect(result.children[0].tags).toEqual(['#tag1', '#tag2'])
    expect(result.children[0].children[0].tags).toEqual(['#tag3', '#tag1', '#tag2'])
  })

  test('should handle nodes with no tags in propagation', () => {
    const doc: ZDoc = docMake([
      { ...lineMake(0, 'Parent with no tags') },
      { ...lineMake(1, 'Child with no tags') },
      { ...lineMake(0, 'Another parent #tag1') },
      { ...lineMake(1, 'Child should inherit') },
    ])

    const result = treeifyDoc(doc)

    expect(result.children[0].tags).toEqual([])
    expect(result.children[0].children[0].tags).toEqual([])
    expect(result.children[1].tags).toEqual(['#tag1'])
    expect(result.children[1].children[0].tags).toEqual(['#tag1'])
  })
})
