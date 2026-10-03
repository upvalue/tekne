// @vitest-environment node
import { describe, test, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { sql } from 'kysely'
import { makeTestDb } from './testing'
import { MIGRATIONS, migrateDown, migrateToLatest } from './migrations'

describe('migration provider', () => {
  test('the provider map matches the migrations directory exactly', () => {
    const dir = path.join(__dirname, 'migrations')
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => f.replace(/\.ts$/, ''))
      .sort()

    expect(Object.keys(MIGRATIONS).sort()).toEqual(files)
  })

  test('migration keys sort in timestamp order', () => {
    const keys = Object.keys(MIGRATIONS)
    const sorted = [...keys].sort()
    expect(keys).toEqual(sorted)
  })

  test('down reverts one migration and latest reapplies it', async () => {
    const { db } = await makeTestDb()
    const applied = async () =>
      (
        await sql<{
          name: string
        }>`select name from kysely_migration order by name`.execute(db)
      ).rows.map(({ name }) => name)
    const names = Object.keys(MIGRATIONS)
    try {
      expect(await applied()).toEqual(names)
      await migrateDown(db)
      expect(await applied()).toEqual(names.slice(0, -1))
      await migrateToLatest(db)
      expect(await applied()).toEqual(names)
    } finally {
      await db.destroy()
    }
  }, 60_000)
})
