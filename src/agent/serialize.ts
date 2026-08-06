// serialize.ts - Document rendering for the agent's prompt.

import type { ZDoc } from '@/docs/schema'

/**
 * One row per line: `id|indent|mdContent`. `timeCreated` ids are ISO
 * timestamps (no `|`), and mdContent is single-line by construction, so the
 * format is unambiguous without escaping.
 */
export const serializeDocForPrompt = (doc: ZDoc): string =>
  doc.children
    .map((line) => `${line.timeCreated}|${line.indent}|${line.mdContent}`)
    .join('\n')
