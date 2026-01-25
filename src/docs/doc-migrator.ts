// doc-migrator.ts

// This is a pretty hacky and slop-coded document migrator, intended
// to make it relatively easy to change the document schema on the fly
import { CURRENT_SCHEMA_VERSION, zdoc, zline, type ZDoc, type ZLine } from './schema'
import { ZodError } from 'zod'

/**
 * Extract allowed field names from a Zod object schema
 */
const getZodObjectKeys = (zodSchema: any): Set<string> => {
  try {
    // For ZodObject, we can access the shape property
    if (zodSchema._def && zodSchema._def.shape) {
      return new Set(Object.keys(zodSchema._def.shape))
    }
    
    // Fallback: try to parse an empty object to get validation errors
    // This will tell us what fields are required
    const shape = zodSchema.shape || zodSchema._def.shape
    if (shape) {
      return new Set(Object.keys(shape))
    }
    
    return new Set()
  } catch (error) {
    console.warn('Could not extract keys from Zod schema:', error)
    return new Set()
  }
}

export interface MigrationOperation {
  type: 'rename' | 'delete' | 'add' | 'update'
  path: string
  oldValue?: any
  newValue?: any
  description: string
}

export interface MigrationReport {
  documentTitle: string
  originalVersion?: number
  targetVersion: number
  operations: MigrationOperation[]
  migrated: boolean
}

/**
 * Migrates a document body to the current schema version and provides
 * a detailed report of what changes were made.
 *
 * @param title - Document title (used for reporting only)
 * @param body - Document body to migrate
 * @returns The migrated body and a migration report
 */
export const migrateDocWithReport = (
  title: string,
  body: ZDoc
): { migratedBody: ZDoc; report: MigrationReport } => {
  const report: MigrationReport = {
    documentTitle: title,
    originalVersion: body?.schemaVersion,
    targetVersion: CURRENT_SCHEMA_VERSION,
    operations: [],
    migrated: false,
  }

  // Clone the body to avoid mutations
  // We cast through unknown because we need to handle legacy fields not in ZDoc
  let migratedBody = JSON.parse(JSON.stringify(body)) as ZDoc & {
    children?: Array<ZLine & { createdAt?: string; updatedAt?: string; datumTime?: number }>
  }

  // Ensure body has correct structure
  if (!migratedBody || typeof migratedBody !== 'object') {
    migratedBody = {
      type: 'doc',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      children: [],
    }
    report.operations.push({
      type: 'add',
      path: 'body',
      newValue: migratedBody,
      description: 'Added missing document body structure',
    })
    report.migrated = true
  }

  // Ensure children array exists
  if (!migratedBody.children) {
    migratedBody.children = []
    report.operations.push({
      type: 'add',
      path: 'children',
      newValue: [],
      description: 'Added missing children array',
    })
    report.migrated = true
  }

  // Migrate each child line
  migratedBody.children = migratedBody.children.map(
    (child, index: number) => {
      // Cast to handle legacy fields
      const legacyChild = child as ZLine & {
        createdAt?: string
        updatedAt?: string
        datumTime?: number
      }
      const mod: ZLine = { ...legacyChild }

      // Migrate createdAt -> timeCreated
      if (legacyChild.createdAt) {
        mod.timeCreated = legacyChild.createdAt
        delete (mod as typeof legacyChild).createdAt
        report.operations.push({
          type: 'rename',
          path: `children[${index}].createdAt`,
          oldValue: legacyChild.createdAt,
          newValue: mod.timeCreated,
          description: `Renamed 'createdAt' to 'timeCreated'`,
        })
        report.migrated = true
      }

      // Migrate updatedAt -> timeUpdated
      if (legacyChild.updatedAt) {
        mod.timeUpdated = legacyChild.updatedAt
        delete (mod as typeof legacyChild).updatedAt
        report.operations.push({
          type: 'rename',
          path: `children[${index}].updatedAt`,
          oldValue: legacyChild.updatedAt,
          newValue: mod.timeUpdated,
          description: `Renamed 'updatedAt' to 'timeUpdated'`,
        })
        report.migrated = true
      }

      // Migrate datumTime -> datumTimeSeconds
      if (legacyChild.datumTime !== undefined) {
        mod.datumTimeSeconds = legacyChild.datumTime
        delete (mod as typeof legacyChild).datumTime
        report.operations.push({
          type: 'rename',
          path: `children[${index}].datumTime`,
          oldValue: legacyChild.datumTime,
          newValue: mod.datumTimeSeconds,
          description: `Renamed 'datumTime' to 'datumTimeSeconds'`,
        })
        report.migrated = true
      }

      return mod
    }
  )

  // Update schema version if it's outdated
  if (migratedBody.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    const oldVersion = migratedBody.schemaVersion
    migratedBody.schemaVersion = CURRENT_SCHEMA_VERSION
    report.operations.push({
      type: 'update',
      path: 'schemaVersion',
      oldValue: oldVersion,
      newValue: CURRENT_SCHEMA_VERSION,
      description: `Updated schema version from ${oldVersion || 'undefined'} to ${CURRENT_SCHEMA_VERSION}`,
    })
    report.migrated = true
  }

  return { migratedBody, report }
}

/**
 * Migrates a document body to the current schema version.
 *
 * @param title - Document title (used for reporting only)
 * @param body - Document body to migrate
 * @returns The migrated body
 */
export const docMigrator = (title: string, body: ZDoc): ZDoc => {
  const { migratedBody } = migrateDocWithReport(title, body)
  return migratedBody
}

export interface ValidationResult {
  title: string
  valid: boolean
  errors: string[]
  warnings: string[]
  extraFields: string[]
  canBeFxedByMigration?: boolean
  migrationReport?: MigrationReport
}

/**
 * Validates a document body against the current schema and checks if migration can fix issues.
 *
 * @param title - Document title (used for reporting)
 * @param body - Document body to validate
 * @returns Validation result with migration info if applicable
 */
export const validateDocumentWithMigrationCheck = (
  title: string,
  body: ZDoc
): ValidationResult => {
  const validationResult: ValidationResult = {
    title,
    valid: true,
    errors: [],
    warnings: [],
    extraFields: [],
    canBeFxedByMigration: false,
  }

  // First, try validating the original document
  try {
    zdoc.parse(body)

    // Check for extra fields in document body
    if (typeof body === 'object' && body !== null) {
      const allowedDocFields = getZodObjectKeys(zdoc)
      const actualDocFields = new Set(Object.keys(body))

      for (const field of actualDocFields) {
        if (!allowedDocFields.has(field)) {
          validationResult.extraFields.push(`doc.${field}`)
          validationResult.valid = false
        }
      }

      // Check children for extra fields
      if (Array.isArray(body.children)) {
        const allowedLineFields = getZodObjectKeys(zline)

        body.children.forEach((child: ZLine, idx: number) => {
          if (typeof child === 'object' && child !== null) {
            const actualLineFields = new Set(Object.keys(child))

            for (const field of actualLineFields) {
              if (!allowedLineFields.has(field)) {
                validationResult.extraFields.push(`children[${idx}].${field}`)
                validationResult.valid = false
              }
            }
          }
        })
      }
    }
  } catch (error) {
    validationResult.valid = false
    if (error instanceof ZodError) {
      validationResult.errors.push(
        ...error.issues.map((e) => `${e.path.join('.')}: ${e.message}`)
      )
    } else {
      validationResult.errors.push(String(error))
    }
  }

  // If document is already valid, no need to check migration
  if (validationResult.valid) {
    return validationResult
  }

  // Document is invalid, check if migration can fix it
  try {
    const { migratedBody, report } = migrateDocWithReport(title, body)
    validationResult.migrationReport = report

    // Now validate the migrated document
    try {
      zdoc.parse(migratedBody)

      // Check for extra fields in migrated document
      let migratedIsValid = true
      const migratedExtraFields: string[] = []

      if (typeof migratedBody === 'object' && migratedBody !== null) {
        const allowedDocFields = getZodObjectKeys(zdoc)
        const actualDocFields = new Set(Object.keys(migratedBody))

        for (const field of actualDocFields) {
          if (!allowedDocFields.has(field)) {
            migratedExtraFields.push(`doc.${field}`)
            migratedIsValid = false
          }
        }

        // Check children for extra fields
        if (Array.isArray(migratedBody.children)) {
          const allowedLineFields = getZodObjectKeys(zline)

          migratedBody.children.forEach((child: ZLine, idx: number) => {
            if (typeof child === 'object' && child !== null) {
              const actualLineFields = new Set(Object.keys(child))

              for (const field of actualLineFields) {
                if (!allowedLineFields.has(field)) {
                  migratedExtraFields.push(`children[${idx}].${field}`)
                  migratedIsValid = false
                }
              }
            }
          })
        }
      }

      // If migrated version is valid, then migration can fix this document
      if (migratedIsValid) {
        validationResult.canBeFxedByMigration = true
      }
    } catch {
      // Migration couldn't fix the validation errors
      validationResult.canBeFxedByMigration = false
    }
  } catch {
    // Migration itself failed
    validationResult.canBeFxedByMigration = false
  }

  return validationResult
}
