import { describe, test, expect } from 'vitest'
import { InternalLinkRegex, TagRegex } from './regex'

describe('InternalLinkRegex', () => {
  test('matches internal link starting with $', () => {
    const text = '$SomeText]]'
    const match = InternalLinkRegex.exec(text)
    expect(match).toBeTruthy()
    expect(match![0]).toBe('$SomeText]]')
  })

  test('should not match only one closing bracket', () => {
    const text = '$SomeText]'
    const match = InternalLinkRegex.exec(text)
    expect(match).toBeNull()
  })

  test('matches internal link starting with #', () => {
    const text = '#MyPage]]'
    const match = InternalLinkRegex.exec(text)
    expect(match).toBeTruthy()
    expect(match![0]).toBe('MyPage]]')
  })

  test('matches link with spaces', () => {
    const text = '$My Page Name]]'
    const match = InternalLinkRegex.exec(text)
    expect(match).toBeTruthy()
    expect(match![0]).toBe('$My Page Name]]')
  })

  test('matches link with forward slashes', () => {
    const text = '#folder/subfolder/page]]'
    const match = InternalLinkRegex.exec(text)
    expect(match).toBeTruthy()
    expect(match![0]).toBe('folder/subfolder/page]]')
  })

  test('matches link with alphanumeric characters', () => {
    const text = '$Text123ABC]]'
    const match = InternalLinkRegex.exec(text)
    expect(match).toBeTruthy()
    expect(match![0]).toBe('$Text123ABC]]')
  })

  test('does not match text without $ or # prefix', () => {
    const text = 'SomeText'
    const match = InternalLinkRegex.exec(text)
    expect(match).toBeNull()
  })

  test('does not match without closing brackets', () => {
    const text = '$SomeText'
    const match = InternalLinkRegex.exec(text)
    expect(match).toBeNull()
  })

  test('does not match empty after prefix', () => {
    const text = '$]]'
    const match = InternalLinkRegex.exec(text)
    expect(match).toBeNull()
  })
})

describe('TagRegex', () => {
  test('matches simple tag', () => {
    const text = 'test-like-this '
    const match = TagRegex.exec(text)
    expect(match).toBeTruthy()
    expect(match![0]).toBe('test-like-this')
  })

  test('matches tag with numbers', () => {
    const text = 'tag123 '
    const match = TagRegex.exec(text)
    expect(match).toBeTruthy()
    expect(match![0]).toBe('tag123')
  })

  test('matches tag at end of string', () => {
    const text = 'endtag'
    const match = TagRegex.exec(text)
    expect(match).toBeTruthy()
    expect(match![0]).toBe('endtag')
  })

  test('matches tag with hyphens', () => {
    const text = 'multi-word-tag '
    const match = TagRegex.exec(text)
    expect(match).toBeTruthy()
    expect(match![0]).toBe('multi-word-tag')
  })

  test('does not match text with only numbers and symbols', () => {
    const text = '123-456'
    const match = TagRegex.exec(text)
    expect(match).toBeNull()
  })

  test('does not match tag starting with space', () => {
    const text = ' invalid-tag'
    const match = TagRegex.exec(text)
    expect(match).toBeNull()
  })
})
