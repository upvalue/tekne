import z from 'zod'

export const documentNameSchema = z
  .string()
  .min(1, 'Document name cannot be empty')
  .max(255, 'Document name too long')
  .regex(
    /^(\$[a-zA-Z0-9\s\-_.,:;()[\]{}'"/\\&*+~`|]+|[a-zA-Z0-9\s\-_.,:;()[\]{}'"/\\&*+~`|]+)$/,
    'Document name contains invalid characters. Only alphanumeric characters and normal punctuation are allowed. $ is only allowed at the beginning for templates.'
  )

export const validateDocumentName = (name: string) => {
  return documentNameSchema.safeParse(name)
}

export type DocumentNameValidation = ReturnType<typeof validateDocumentName>
