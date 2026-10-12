import { useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { uiStore } from './panel-state'

export const WRITING_PROMPTS = [
  '· • · ∙ •',
  '< > < < >',
  '○ ◕ ◑ ● ◔',
  '⠑ ⠼ ⡇ ⢎ ⠟',
] as const
const writingPromptAtom = atomWithStorage('tekne.writingPrompt', 0)
export const useWritingPrompt = () =>
  useAtom(writingPromptAtom, { store: uiStore })

export const writingPrompt = (index: number, lineId: string = 'empty') => {
  let seed = 2166136261
  for (const char of lineId)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619)
  const symbols = [
    ['·', '•', '∙'],
    ['<', '>'],
    ['○', '◔', '◑', '◕', '●'],
  ][index] ?? ['·', '•', '∙']
  return Array.from({ length: 5 }, () => {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    const value = seed >>> 0
    return index === 3
      ? String.fromCodePoint(0x2801 + (value % 255))
      : symbols[value % symbols.length]
  }).join(' ')
}
