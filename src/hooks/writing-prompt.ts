export const writingPrompt = (lineId: string = 'empty') => {
  let seed = 2166136261
  for (const char of lineId)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619)
  return Array.from({ length: 5 }, () => {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    return String.fromCodePoint(0x2801 + ((seed >>> 0) % 255))
  }).join(' ')
}
