import { z } from 'zod'
import { lineIdMake, LINE_ID_PATTERN } from './line-identity'

const zline = z.object({
  type: z.literal('line'),
  id: z.string().regex(LINE_ID_PATTERN),
  mdContent: z.string(),
  indent: z.number().int().nonnegative(),
  timeCreated: z.iso.datetime(),
  timeUpdated: z.iso.datetime(),
  collapsed: z.boolean().optional(),

  datumTimeSeconds: z.number().optional(),

  datumTaskStatus: z.optional(z.enum(['complete', 'incomplete', 'unset'])),

  /** When the line was pinned. */
  datumPinnedAt: z.optional(z.iso.datetime()),
})

type ZLine = z.infer<typeof zline>

const zdoc = z.object({
  type: z.literal('doc'),
  schemaVersion: z
    .number()
    .refine(
      (version) => version === 2,
      'Document schema changed; reload Tekne before saving'
    ),
  children: z
    .array(zline)
    .refine(
      (lines) => new Set(lines.map((line) => line.id)).size === lines.length,
      'Line IDs must be unique'
    ),
})

type ZDoc = z.infer<typeof zdoc>

const lineMake = (
  indent: number,
  mdContent: string = '',
  rest?: Partial<ZLine>
): ZLine => {
  const timestamp = new Date().toISOString()
  return {
    type: 'line',
    id: lineIdMake(),
    mdContent,
    indent,
    timeCreated: timestamp,
    timeUpdated: timestamp,
    ...(rest ? rest : {}),
  }
}

const CURRENT_SCHEMA_VERSION = 2

const docMake = (children: ZLine[] = []): ZDoc => ({
  type: 'doc',
  schemaVersion: CURRENT_SCHEMA_VERSION,
  children,
})

export {
  zline,
  zdoc,
  lineMake,
  docMake,
  CURRENT_SCHEMA_VERSION,
  type ZLine,
  type ZDoc,
}

/** Copy content into new lines; identity and creation dates belong to the copy. */
export const copyLines = (lines: ZLine[]): ZLine[] => {
  const timestamp = new Date().toISOString()
  return lines.map((line) => ({
    ...line,
    id: lineIdMake(),
    timeCreated: timestamp,
    timeUpdated: timestamp,
  }))
}
