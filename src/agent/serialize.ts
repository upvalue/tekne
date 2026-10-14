import type { ZDoc } from '@/docs/schema'

/**
 * One row per line: `id|indent|mdContent`. Line ids contain no `|`,
 * and mdContent is single-line by construction, so the format is unambiguous without escaping.
 */
export const serializeDocForPrompt = (doc: ZDoc): string =>
  doc.children
    .map((line) => `${line.id}|${line.indent}|${line.mdContent}`)
    .join('\n')
