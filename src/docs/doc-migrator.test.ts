import { describe, test, expect } from 'vitest'
import {
  docMigrator,
  migrateDocWithReport,
  validateDocumentWithMigrationCheck,
} from './doc-migrator'
import { CURRENT_SCHEMA_VERSION, docMake, lineMake, type ZDoc } from './schema'

// The migrator reshapes persisted user documents, so its behavior is pinned
// against representative legacy shapes.

const legacyLine = {
  type: 'line',
  mdContent: 'timed work',
  indent: 0,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-02T00:00:00.000Z',
  datumTime: 90,
}

const legacyDoc = {
  type: 'doc',
  children: [legacyLine],
} as unknown as ZDoc

describe('migrateDocWithReport', () => {
  test('renames legacy fields and stamps the current schema version', () => {
    const { migratedBody, report } = migrateDocWithReport('Legacy', legacyDoc)

    expect(report.migrated).toBe(true)
    expect(migratedBody.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)

    const line = migratedBody.children[0]
    expect(line.timeCreated).toBe('2024-01-01T00:00:00.000Z')
    expect(line.timeUpdated).toBe('2024-01-02T00:00:00.000Z')
    expect(line.datumTimeSeconds).toBe(90)
    expect(line).not.toHaveProperty('createdAt')
    expect(line).not.toHaveProperty('updatedAt')
    expect(line).not.toHaveProperty('datumTime')
  })

  test('reports each operation it performed', () => {
    const { report } = migrateDocWithReport('Legacy', legacyDoc)
    const paths = report.operations.map((op) => op.path)
    expect(paths).toContain('children[0].createdAt')
    expect(paths).toContain('children[0].updatedAt')
    expect(paths).toContain('children[0].datumTime')
    expect(paths).toContain('schemaVersion')
  })

  test('a current document passes through untouched', () => {
    const doc = docMake([lineMake(0, 'fine')])
    const { migratedBody, report } = migrateDocWithReport('Modern', doc)
    expect(report.migrated).toBe(false)
    expect(report.operations).toEqual([])
    expect(migratedBody).toEqual(doc)
  })

  test('repairs a missing children array', () => {
    const bare = { type: 'doc' } as unknown as ZDoc
    const { migratedBody, report } = migrateDocWithReport('Bare', bare)
    expect(report.migrated).toBe(true)
    expect(migratedBody.children).toEqual([])
  })

  test('docMigrator does not mutate its input', () => {
    const input = JSON.parse(JSON.stringify(legacyDoc))
    docMigrator('Legacy', input)
    expect(input).toEqual(legacyDoc)
  })
})

describe('validateDocumentWithMigrationCheck', () => {
  test('flags a legacy document as fixable by migration', () => {
    const result = validateDocumentWithMigrationCheck('Legacy', legacyDoc)
    expect(result.valid).toBe(false)
    expect(result.canBeFxedByMigration).toBe(true)
  })

  test('accepts a current document', () => {
    const result = validateDocumentWithMigrationCheck(
      'Modern',
      docMake([lineMake(0, 'fine')])
    )
    expect(result).toMatchObject({ valid: true, errors: [], extraFields: [] })
  })

  test('reports unknown extra fields that migration cannot fix', () => {
    const doc = docMake([{ ...lineMake(0, 'line'), mystery: true } as never])
    const result = validateDocumentWithMigrationCheck('Extra', doc)
    expect(result.valid).toBe(false)
    expect(result.extraFields).toContain('children[0].mystery')
    expect(result.canBeFxedByMigration).toBe(false)
  })
})
