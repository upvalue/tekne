import z from 'zod'
import { TagNameExactRegex } from './regex'

export const documentNameSchema = z
  .string()
  .min(1, 'Document name cannot be empty')
  .max(255, 'Document name too long')
  .regex(
    /^(\$[a-zA-Z0-9\s\-_.,:;()[\]{}'"/\\&*+~`|]+|[a-zA-Z0-9\s\-_.,:;()[\]{}'"/\\&*+~`|]+)$/,
    'Document name contains invalid characters. Only alphanumeric characters and normal punctuation are allowed. $ is only allowed at the beginning for templates.'
  )

/** A tag name without the leading '#', e.g. "proj/tekne". */
export const tagNameSchema = z
  .string()
  .min(1, 'Tag name cannot be empty')
  .max(255, 'Tag name too long')
  .regex(
    TagNameExactRegex,
    'Tag names must start with a letter and contain only letters, digits, "-" and "/"'
  )

export const validateDocumentName = (name: string) => {
  return documentNameSchema.safeParse(name)
}

export type DocumentNameValidation = ReturnType<typeof validateDocumentName>
