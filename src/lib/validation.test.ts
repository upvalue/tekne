import { describe, it, expect } from 'vitest'
import { validateDocumentName } from './validation'

describe('validateDocumentName', () => {
  it('allows template names starting with $', () => {
    expect(validateDocumentName('$Daily').success).toBe(true)
    expect(validateDocumentName('$Weekly').success).toBe(true)
    expect(validateDocumentName('$Project Template').success).toBe(true)
  })

  it('rejects names with $ in middle', () => {
    expect(validateDocumentName('f$o$o').success).toBe(false)
    expect(validateDocumentName('test$ing').success).toBe(false)
  })

  it('allows normal document names', () => {
    expect(validateDocumentName('2025-08-30').success).toBe(true)
    expect(validateDocumentName('Meeting Notes').success).toBe(true)
    expect(validateDocumentName('Project_Plan').success).toBe(true)
    expect(validateDocumentName('TODO-list').success).toBe(true)
  })

  it('rejects empty names', () => {
    expect(validateDocumentName('').success).toBe(false)
  })

  it('rejects names with forbidden characters', () => {
    expect(validateDocumentName('test!').success).toBe(false)
    expect(validateDocumentName('test@').success).toBe(false)
    expect(validateDocumentName('test#').success).toBe(false)
    expect(validateDocumentName('test%').success).toBe(false)
  })

  it('allows punctuation and symbols', () => {
    expect(validateDocumentName('notes (draft)').success).toBe(true)
    expect(validateDocumentName('file_name.txt').success).toBe(true)
    expect(validateDocumentName('task: done').success).toBe(true)
    expect(validateDocumentName('test&more').success).toBe(true)
  })

  it('rejects very long names', () => {
    const longName = 'a'.repeat(256)
    expect(validateDocumentName(longName).success).toBe(false)
  })
})
