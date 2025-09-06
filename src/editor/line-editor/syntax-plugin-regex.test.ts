import { describe, test, expect } from 'vitest'
import { InternalLinkRegex, TagRegex } from './syntax-plugin'

describe('InternalLinkRegex', () => {
  test('matches simple internal link', () => {
    const text = 'SomeText]]'
    const match = InternalLinkRegex.exec(text)
    expect(match).toBeTruthy()
    expect(match![0]).toBe('SomeText]]')
  })

  test('matches alphanumeric internal link', () => {
    const text = 'Text123]]'
    const match = InternalLinkRegex.exec(text)
    expect(match).toBeTruthy()
    expect(match![0]).toBe('Text123]]')
  })

  test('matches mixed case internal link', () => {
    const text = 'MyPage]]'
    const match = InternalLinkRegex.exec(text)
    expect(match).toBeTruthy()
    expect(match![0]).toBe('MyPage]]')
  })

  test('matches single character internal link', () => {
    const text = 'A]]'
    const match = InternalLinkRegex.exec(text)
    expect(match).toBeTruthy()
    expect(match![0]).toBe('A]]')
  })

  test('does not match when no closing brackets', () => {
    const text = 'SomeText'
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
