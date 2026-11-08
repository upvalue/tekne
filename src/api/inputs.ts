import { z } from 'zod'
import { documentNameSchema } from '@/docs/validation'
import { documentEditSchema } from '@/docs/document-edit'

export const inputs = {
  empty: z.object({}),
  doc: {
    searchDocs: z.object({ query: z.string() }),
    loadDoc: z.object({ name: z.string() }),
    createDoc: z.object({ name: documentNameSchema }),
    createDocFromTemplate: z.object({
      name: documentNameSchema,
      templateName: z.string(),
    }),
    editDoc: z
      .object({
        name: z.string(),
        expectedRevision: z.number().int().nonnegative(),
        requestId: z.uuid(),
        operations: documentEditSchema,
      })
      .strict(),
  },
  search: {
    query: z.object({
      query: z.string(),
      timezone: z.string().default('UTC'),
      limit: z.number().int().min(1).max(100).default(50),
      cursor: z.number().int().nonnegative().default(0),
      summaryOnly: z.boolean().default(false),
      groupBy: z.enum(['tag', 'document']).optional(),
    }),
  },
}
