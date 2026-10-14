import {
  CURRENT_SCHEMA_VERSION,
  zdoc,
  zline,
  type ZDoc,
  type ZLine,
} from './schema'
import { lineIdMake } from './line-identity'
import { ZodError } from 'zod'

/** Extra fields are checked on the original input, before Zod strips them. */
const getDocumentExtraFields = (body: ZDoc): string[] => {
  const extraFields = (value: object, allowed: Set<string>, path: string) =>
    Object.keys(value)
      .filter((field) => !allowed.has(field))
      .map((field) => `${path}.${field}`)
  const allowedDocFields = new Set(Object.keys(zdoc.shape))
  const allowedLineFields = new Set(Object.keys(zline.shape))

  return [
    ...extraFields(body, allowedDocFields, 'doc'),
    ...body.children.flatMap((child, index) =>
      extraFields(child, allowedLineFields, `children[${index}]`)
    ),
  ]
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

/** Migrate the body and report changes; title is used only in the report. */
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

  // We cast through unknown because we need to handle legacy fields not in ZDoc
  let migratedBody = JSON.parse(JSON.stringify(body)) as ZDoc & {
    children?: Array<
      ZLine & { createdAt?: string; updatedAt?: string; datumTime?: number }
    >
  }

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

  migratedBody.children = migratedBody.children.map((child, index: number) => {
    const legacyChild = child as ZLine & {
      createdAt?: string
      updatedAt?: string
      datumTime?: number
    }
    const mod: ZLine = { ...legacyChild }
    if ((body.schemaVersion ?? 0) < 2 && !mod.id) {
      mod.id = lineIdMake()
      report.operations.push({
        type: 'add',
        path: `children[${index}].id`,
        newValue: mod.id,
        description: 'Assigned a line ID',
      })
      report.migrated = true
    }

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
  })

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

/** Migrate the body to the current schema. */
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

/** Validate the body and report whether migration can repair it. */
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

  try {
    zdoc.parse(body)

    validationResult.extraFields = getDocumentExtraFields(body)
    validationResult.valid = validationResult.extraFields.length === 0
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

  if (validationResult.valid) {
    return validationResult
  }

  try {
    const { migratedBody, report } = migrateDocWithReport(title, body)
    validationResult.migrationReport = report

    zdoc.parse(migratedBody)
    validationResult.canBeFxedByMigration =
      getDocumentExtraFields(migratedBody).length === 0
  } catch {
    // Migration or validation failed; the document still needs a manual fix.
    validationResult.canBeFxedByMigration = false
  }

  return validationResult
}
