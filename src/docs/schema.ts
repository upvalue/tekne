// schema.ts - schema definition and raw line operations (eg no external dependencies)
import { z } from 'zod'

const colorEnum = z.enum(['yellow', 'blue', 'purple', 'red', 'green'])

const zline = z.object({
  type: z.literal('line'),
  mdContent: z.string(),
  indent: z.number(),
  timeCreated: z.iso.datetime(),
  timeUpdated: z.iso.datetime(),
  collapsed: z.boolean().optional(),

  /**
   * Time recorded (in seconds)
   */
  datumTimeSeconds: z.number().optional(),

  /**
   * Task completion status
   */
  datumTaskStatus: z.optional(z.enum(['complete', 'incomplete', 'unset'])),

  /**
   * If a line was pinned, when
   */
  datumPinnedAt: z.optional(z.iso.datetime()),

  /**
   * Line background color
   */
  color: z.optional(colorEnum),
})

type ZLine = z.infer<typeof zline>

const zdoc = z.object({
  type: z.literal('doc'),
  schemaVersion: z.number(),
  children: z.array(zline),
})

type ZDoc = z.infer<typeof zdoc>

let lastGeneratedLineTimestampMs = 0

const lineTimestampMake = () => {
  const timestampMs = Math.max(Date.now(), lastGeneratedLineTimestampMs + 1)
  lastGeneratedLineTimestampMs = timestampMs
  return new Date(timestampMs).toISOString()
}

const lineMake = (
  indent: number,
  mdContent: string = '',
  rest?: Partial<ZLine>
): ZLine => {
  const timestamp = lineTimestampMake()
  return {
    type: 'line',
    mdContent,
    indent,
    timeCreated: timestamp,
    timeUpdated: timestamp,
    ...(rest ? rest : {}),
  }
}

const CURRENT_SCHEMA_VERSION = 1

const docMake = (children: ZLine[] = []): ZDoc => ({
  type: 'doc',
  schemaVersion: CURRENT_SCHEMA_VERSION,
  children,
})

export {
  zline,
  zdoc,
  lineMake,
  lineTimestampMake,
  docMake,
  CURRENT_SCHEMA_VERSION,
  type ZLine,
  type ZDoc,
}

export type LineColor = z.infer<typeof colorEnum>
