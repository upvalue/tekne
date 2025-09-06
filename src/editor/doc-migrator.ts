// doc-migrator.ts

// This is a pretty hacky and slop-coded document migrator, intended
// to make it relatively easy to change the document schema on the fly
import { CURRENT_SCHEMA_VERSION, zdoc, zline } from './schema'
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
 * Migrates a document to the current schema version and provides
 * a detailed report of what changes were made
 */
export const migrateDocWithReport = (
  doc: any
): { migratedDoc: any; report: MigrationReport } => {
  const report: MigrationReport = {
    documentTitle: doc.title,
    originalVersion: doc.body?.schemaVersion,
    targetVersion: CURRENT_SCHEMA_VERSION,
    operations: [],
    migrated: false,
  }

  // Clone the document to avoid mutations
  const migratedDoc = JSON.parse(JSON.stringify(doc))

  // Ensure body exists
  if (!migratedDoc.body) {
    migratedDoc.body = {
      type: 'doc',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      children: [],
    }
    report.operations.push({
      type: 'add',
      path: 'body',
      newValue: migratedDoc.body,
      description: 'Added missing document body structure',
    })
    report.migrated = true
  }

  // Ensure children array exists
  if (!migratedDoc.body.children) {
    migratedDoc.body.children = []
    report.operations.push({
      type: 'add',
      path: 'body.children',
      newValue: [],
      description: 'Added missing children array',
    })
    report.migrated = true
  }

  // Migrate each child line
  migratedDoc.body.children = migratedDoc.body.children.map(
    (child: any, index: number) => {
      const mod = { ...child }

      // Migrate createdAt -> timeCreated
      if (child.createdAt) {
        mod.timeCreated = child.createdAt
        delete mod.createdAt
        report.operations.push({
          type: 'rename',
          path: `children[${index}].createdAt`,
          oldValue: child.createdAt,
          newValue: mod.timeCreated,
          description: `Renamed 'createdAt' to 'timeCreated'`,
        })
        report.migrated = true
      }

      // Migrate updatedAt -> timeUpdated
      if (child.updatedAt) {
        mod.timeUpdated = child.updatedAt
        delete mod.updatedAt
        report.operations.push({
          type: 'rename',
          path: `children[${index}].updatedAt`,
          oldValue: child.updatedAt,
          newValue: mod.timeUpdated,
          description: `Renamed 'updatedAt' to 'timeUpdated'`,
        })
        report.migrated = true
      }

      // Migrate datumTime -> datumTimeSeconds
      if (child.datumTime !== undefined) {
        mod.datumTimeSeconds = child.datumTime
        delete mod.datumTime
        report.operations.push({
          type: 'rename',
          path: `children[${index}].datumTime`,
          oldValue: child.datumTime,
          newValue: mod.datumTimeSeconds,
          description: `Renamed 'datumTime' to 'datumTimeSeconds'`,
        })
        report.migrated = true
      }

      // Handle datumTaskStatus (ensure it exists if referenced)
      if (child.datumTaskStatus !== undefined) {
        mod.datumTaskStatus = child.datumTaskStatus
        // This field already exists in current schema, so no migration needed
        // but we preserve it explicitly
      }

      return mod
    }
  )

  // Update schema version if it's outdated
  if (migratedDoc.body.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    const oldVersion = migratedDoc.body.schemaVersion
    migratedDoc.body.schemaVersion = CURRENT_SCHEMA_VERSION
    report.operations.push({
      type: 'update',
      path: 'body.schemaVersion',
      oldValue: oldVersion,
      newValue: CURRENT_SCHEMA_VERSION,
      description: `Updated schema version from ${oldVersion || 'undefined'} to ${CURRENT_SCHEMA_VERSION}`,
    })
    report.migrated = true
  }

  return { migratedDoc, report }
}

/**
 * Legacy function for backwards compatibility
 * This is the original docMigrator from router.ts without reporting
 */
export const docMigrator = (doc: any): any => {
  const { migratedDoc } = migrateDocWithReport(doc)
  return migratedDoc
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
 * Validates a document against the current schema and checks if migration can fix issues
 */
export const validateDocumentWithMigrationCheck = (
  doc: any
): ValidationResult => {
  const validationResult: ValidationResult = {
    title: doc.title,
    valid: true,
    errors: [],
    warnings: [],
    extraFields: [],
    canBeFxedByMigration: false,
  }

  // First, try validating the original document
  try {
    zdoc.parse(doc.body)

    // Check for extra fields in document body
    const docBody = doc.body
    if (typeof docBody === 'object' && docBody !== null) {
      const allowedDocFields = getZodObjectKeys(zdoc)
      const actualDocFields = new Set(Object.keys(docBody))

      for (const field of actualDocFields) {
        if (!allowedDocFields.has(field)) {
          validationResult.extraFields.push(`doc.${field}`)
          validationResult.valid = false
        }
      }

      // Check children for extra fields
      if (Array.isArray(docBody.children)) {
        const allowedLineFields = getZodObjectKeys(zline)

        docBody.children.forEach((child: any, idx: number) => {
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
        ...error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`)
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
    const { migratedDoc, report } = migrateDocWithReport(doc)
    validationResult.migrationReport = report

    // Now validate the migrated document
    try {
      zdoc.parse(migratedDoc.body)

      // Check for extra fields in migrated document
      let migratedIsValid = true
      const migratedExtraFields: string[] = []

      const docBody = migratedDoc.body
      if (typeof docBody === 'object' && docBody !== null) {
        const allowedDocFields = getZodObjectKeys(zdoc)
        const actualDocFields = new Set(Object.keys(docBody))

        for (const field of actualDocFields) {
          if (!allowedDocFields.has(field)) {
            migratedExtraFields.push(`doc.${field}`)
            migratedIsValid = false
          }
        }

        // Check children for extra fields
        if (Array.isArray(docBody.children)) {
          const allowedLineFields = getZodObjectKeys(zline)

          docBody.children.forEach((child: any, idx: number) => {
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
    } catch (migrationValidationError) {
      // Migration couldn't fix the validation errors
      validationResult.canBeFxedByMigration = false
    }
  } catch (migrationError) {
    // Migration itself failed
    validationResult.canBeFxedByMigration = false
  }

  return validationResult
}
