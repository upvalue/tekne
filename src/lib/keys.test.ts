import { describe, test, expect } from 'vitest'
import {
  codeMirrorKey,
  displayKey,
  getAllKeybindings,
  keybindings,
  matchesKeybinding,
} from './keys'
import { isApple, modSymbol } from './platform'

/** A keydown carrying whichever modifier 'mod' means on this platform. */
const modDown = (key: string, rest: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', {
    key,
    ...(isApple ? { metaKey: true } : { ctrlKey: true }),
    ...rest,
  })

describe('displayKey', () => {
  test('renders the combos the Help panel used to hardcode', () => {
    expect(displayKey(keybindings.documentSearch)).toBe(`${modSymbol} Shift O`)
    expect(displayKey(keybindings.searchPanel)).toBe(`${modSymbol} /`)
    expect(displayKey(keybindings.togglePanel)).toBe(`${modSymbol} \\`)
    expect(displayKey(keybindings.commandPalette)).toBe(`${modSymbol} K`)
    expect(displayKey(keybindings.toggleCollapse)).toBe(`${modSymbol} .`)
    expect(displayKey(keybindings.goToLine)).toBe('Ctrl G')
    expect(displayKey(keybindings.deleteLine)).toBe(`${modSymbol} Shift K`)
  })
})

describe('adapters', () => {
  test('produce the strings CodeMirror expects', () => {
    expect(codeMirrorKey('toggleCollapse')).toBe('Mod-.')
    expect(codeMirrorKey('deleteLine')).toBe('Mod-Shift-k')
  })
})

describe('matchesKeybinding', () => {
  test('accepts the combo it describes', () => {
    expect(matchesKeybinding(keybindings.commandPalette, modDown('k'))).toBe(
      true
    )
    expect(matchesKeybinding(keybindings.searchPanel, modDown('/'))).toBe(true)
    expect(matchesKeybinding(keybindings.togglePanel, modDown('\\'))).toBe(true)
  })

  test('opens documents with the new shortcut and leaves Mod-O to the browser', () => {
    expect(
      matchesKeybinding(
        keybindings.documentSearch,
        modDown('O', { shiftKey: true })
      )
    ).toBe(true)
    expect(matchesKeybinding(keybindings.documentSearch, modDown('o'))).toBe(
      false
    )
  })

  test('treats ctrl as the literal key on every platform', () => {
    const event = new KeyboardEvent('keydown', { key: 'g', ctrlKey: true })

    expect(matchesKeybinding(keybindings.goToLine, event)).toBe(true)
  })

  test('ignores the key without its modifier', () => {
    const bare = new KeyboardEvent('keydown', { key: 'k' })

    expect(matchesKeybinding(keybindings.commandPalette, bare)).toBe(false)
  })

  test('requires modifiers to match exactly, so Shift is not swallowed', () => {
    // The old hand-rolled Cmd+/ handler never checked shift, so Cmd+? opened
    // the search panel too.
    const withShift = modDown('/', { shiftKey: true })

    expect(matchesKeybinding(keybindings.searchPanel, withShift)).toBe(false)
  })

  test('matches regardless of the case the browser reports', () => {
    expect(matchesKeybinding(keybindings.commandPalette, modDown('K'))).toBe(
      true
    )
  })
})

describe('the registry itself', () => {
  test('has no duplicate combos', () => {
    const keys = getAllKeybindings().map((binding) => binding.key)

    expect(new Set(keys).size).toBe(keys.length)
  })
})
