// @vitest-environment node
import { describe, test, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { MIGRATIONS } from './migrations'

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
})
