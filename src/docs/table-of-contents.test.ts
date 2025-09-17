import { describe, it, expect } from 'vitest'
import { generateTableOfContents } from './table-of-contents'
import { lineMake } from './schema'

describe('generateTableOfContents', () => {
  it('should return empty array for no headings', () => {
    const lines = [
      lineMake(0, 'regular text'),
      lineMake(1, 'more text'),
    ]
    
    const result = generateTableOfContents(lines)
    expect(result).toEqual([])
  })

  it('should handle single heading', () => {
    const lines = [
      lineMake(0, '# Single heading'),
    ]
    
    const result = generateTableOfContents(lines)
    expect(result).toEqual([
      { lineIdx: 0, content: '# Single heading', indentLevel: 0, isActive: false }
    ])
  })

  it('should handle multiple flat headings at same indent', () => {
    const lines = [
      lineMake(0, '# First heading'),
      lineMake(0, '## Second heading'),
      lineMake(0, '### Third heading'),
    ]
    
    const result = generateTableOfContents(lines)
    expect(result).toEqual([
      { lineIdx: 0, content: '# First heading', indentLevel: 0, isActive: false },
      { lineIdx: 1, content: '## Second heading', indentLevel: 0, isActive: false },
      { lineIdx: 2, content: '### Third heading', indentLevel: 0, isActive: false }
    ])
  })

  it('should calculate indent levels based on document indent hierarchy', () => {
    const lines = [
      lineMake(0, '# heading 1'),
      lineMake(1, '# heading 2'),
      lineMake(2, '### heading 3'),
    ]
    
    const result = generateTableOfContents(lines)
    expect(result).toEqual([
      { lineIdx: 0, content: '# heading 1', indentLevel: 0, isActive: false },
      { lineIdx: 1, content: '# heading 2', indentLevel: 1, isActive: false },
      { lineIdx: 2, content: '### heading 3', indentLevel: 2, isActive: false }
    ])
  })

  it('should handle complex nested structure', () => {
    const lines = [
      lineMake(0, '# Root 1'),
      lineMake(1, '## Child 1.1'),
      lineMake(2, '### Child 1.1.1'),
      lineMake(1, '## Child 1.2'),
      lineMake(0, '# Root 2'),
      lineMake(1, '## Child 2.1'),
    ]
    
    const result = generateTableOfContents(lines)
    expect(result).toEqual([
      { lineIdx: 0, content: '# Root 1', indentLevel: 0, isActive: false },
      { lineIdx: 1, content: '## Child 1.1', indentLevel: 1, isActive: false },
      { lineIdx: 2, content: '### Child 1.1.1', indentLevel: 2, isActive: false },
      { lineIdx: 3, content: '## Child 1.2', indentLevel: 1, isActive: false },
      { lineIdx: 4, content: '# Root 2', indentLevel: 0, isActive: false },
      { lineIdx: 5, content: '## Child 2.1', indentLevel: 1, isActive: false }
    ])
  })

  it('should ignore non-heading lines', () => {
    const lines = [
      lineMake(0, 'regular text'),
      lineMake(0, '# First heading'),
      lineMake(0, 'more text'),
      lineMake(1, '## Second heading'),
      lineMake(0, 'even more text'),
    ]
    
    const result = generateTableOfContents(lines)
    expect(result).toEqual([
      { lineIdx: 1, content: '# First heading', indentLevel: 0, isActive: false },
      { lineIdx: 3, content: '## Second heading', indentLevel: 1, isActive: false }
    ])
  })

  it('should handle headings that do not start with space after #', () => {
    const lines = [
      lineMake(0, '#no space'),
      lineMake(0, '# with space'),
      lineMake(0, '##no space'),
      lineMake(0, '## with space'),
    ]
    
    const result = generateTableOfContents(lines)
    expect(result).toEqual([
      { lineIdx: 1, content: '# with space', indentLevel: 0, isActive: false },
      { lineIdx: 3, content: '## with space', indentLevel: 0, isActive: false }
    ])
  })

  it('should handle deep nesting', () => {
    const lines = [
      lineMake(0, '# Level 0'),
      lineMake(1, '# Level 1'),
      lineMake(2, '# Level 2'),
      lineMake(3, '# Level 3'),
      lineMake(2, '# Back to Level 2'),
      lineMake(1, '# Back to Level 1'),
    ]
    
    const result = generateTableOfContents(lines)
    expect(result).toEqual([
      { lineIdx: 0, content: '# Level 0', indentLevel: 0, isActive: false },
      { lineIdx: 1, content: '# Level 1', indentLevel: 1, isActive: false },
      { lineIdx: 2, content: '# Level 2', indentLevel: 2, isActive: false },
      { lineIdx: 3, content: '# Level 3', indentLevel: 3, isActive: false },
      { lineIdx: 4, content: '# Back to Level 2', indentLevel: 2, isActive: false },
      { lineIdx: 5, content: '# Back to Level 1', indentLevel: 1, isActive: false }
    ])
  })

  it('should handle mixed heading types at different indents', () => {
    const lines = [
      lineMake(0, '### Top level with ###'),
      lineMake(1, '# Child with #'),
      lineMake(2, '## Grandchild with ##'),
    ]
    
    const result = generateTableOfContents(lines)
    expect(result).toEqual([
      { lineIdx: 0, content: '### Top level with ###', indentLevel: 0, isActive: false },
      { lineIdx: 1, content: '# Child with #', indentLevel: 1, isActive: false },
      { lineIdx: 2, content: '## Grandchild with ##', indentLevel: 2, isActive: false }
    ])
  })

  it('should mark the closest previous header as active when focusedLineIdx is provided', () => {
    const lines = [
      lineMake(0, '# Header 1'),      // lineIdx 0
      lineMake(0, 'regular text'),    // lineIdx 1
      lineMake(0, '# Header 2'),      // lineIdx 2
      lineMake(0, 'more text'),       // lineIdx 3
      lineMake(0, '# Header 3'),      // lineIdx 4
    ]
    
    // Focus on line 3, should activate Header 2 (lineIdx 2)
    const result = generateTableOfContents(lines, 3)
    expect(result).toEqual([
      { lineIdx: 0, content: '# Header 1', indentLevel: 0, isActive: false },
      { lineIdx: 2, content: '# Header 2', indentLevel: 0, isActive: true },
      { lineIdx: 4, content: '# Header 3', indentLevel: 0, isActive: false }
    ])
  })

  it('should mark the header itself as active when focused on header line', () => {
    const lines = [
      lineMake(0, '# Header 1'),
      lineMake(0, '# Header 2'),
      lineMake(0, '# Header 3'),
    ]
    
    // Focus on Header 2
    const result = generateTableOfContents(lines, 1)
    expect(result).toEqual([
      { lineIdx: 0, content: '# Header 1', indentLevel: 0, isActive: false },
      { lineIdx: 1, content: '# Header 2', indentLevel: 0, isActive: true },
      { lineIdx: 2, content: '# Header 3', indentLevel: 0, isActive: false }
    ])
  })

  it('should not mark any header as active when focused before first header', () => {
    const lines = [
      lineMake(0, 'text before headers'),  // lineIdx 0
      lineMake(0, '# Header 1'),           // lineIdx 1
      lineMake(0, '# Header 2'),           // lineIdx 2
    ]
    
    // Focus on line before any headers
    const result = generateTableOfContents(lines, 0)
    expect(result).toEqual([
      { lineIdx: 1, content: '# Header 1', indentLevel: 0, isActive: false },
      { lineIdx: 2, content: '# Header 2', indentLevel: 0, isActive: false }
    ])
  })
})