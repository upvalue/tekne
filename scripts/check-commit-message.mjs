#!/usr/bin/env node

import { readFileSync } from 'node:fs'

const MAX_LINE_LENGTH = 80
const SCISSORS = '# ------------------------ >8 ------------------------'

const messagePath = process.argv[2]
if (!messagePath) {
  console.error('usage: check-commit-message.mjs <commit-message-file>')
  process.exit(2)
}

const lines = readFileSync(messagePath, 'utf8').split(/\r?\n/)
const overlong = []

for (const [index, line] of lines.entries()) {
  if (line === SCISSORS) break
  if (line.startsWith('#')) continue

  const length = [...line].length
  if (length > MAX_LINE_LENGTH) {
    overlong.push({ line: index + 1, length })
  }
}

if (overlong.length > 0) {
  console.error(
    `commit message lines must not exceed ${MAX_LINE_LENGTH} characters`
  )
  for (const violation of overlong) {
    console.error(`  line ${violation.line}: ${violation.length} characters`)
  }
  process.exit(1)
}
