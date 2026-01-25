// Query parser for search feature
// Parses query strings like "from:2026-01-02 tag:proj/tekne age:90d"

import type { ParsedQuery, ParseError, SearchOperator } from './types'
import type { NoteDataStatus, NoteDataType } from '@/db/types'

const OPERATOR_PATTERN = /^(\w+):(\S+)/
const TAG_PATTERN = /^#([a-zA-Z][a-zA-Z0-9-/]*)$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const AGE_PATTERN = /^(\d+)([dwm])$/

const VALID_OPERATORS = ['tag', 'from', 'to', 'age', 'status', 'has', 'doc']
const VALID_STATUSES: NoteDataStatus[] = ['complete', 'incomplete', 'unset']
const VALID_HAS_VALUES: Array<Exclude<NoteDataType, 'tag'>> = [
  'timer',
  'task',
  'pin',
]

function parseDate(value: string): Date | null {
  if (!DATE_PATTERN.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  // Validate the date is real (e.g., not Feb 30)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

function parseAge(value: string): number | null {
  const match = value.match(AGE_PATTERN)
  if (!match) return null
  const num = parseInt(match[1], 10)
  const unit = match[2]
  switch (unit) {
    case 'd':
      return num
    case 'w':
      return num * 7
    case 'm':
      return num * 30
    default:
      return null
  }
}

function tokenize(query: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < query.length; i++) {
    const char = query[i]

    if (char === '"') {
      inQuotes = !inQuotes
      current += char
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        tokens.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }

  if (current) {
    tokens.push(current)
  }

  return tokens
}

export function parseQuery(query: string): ParsedQuery {
  const operators: SearchOperator[] = []
  const errors: ParseError[] = []
  const tokens = tokenize(query.trim())
  let position = 0

  for (const token of tokens) {
    // Check for #tag syntax first (e.g., #exercise, #proj/tekne)
    const tagMatch = token.match(TAG_PATTERN)
    if (tagMatch) {
      // Store with # prefix since that's how tags are stored in DB
      operators.push({ type: 'tag', value: `#${tagMatch[1]}` })
      position += token.length + 1
      continue
    }

    const opMatch = token.match(OPERATOR_PATTERN)

    if (opMatch) {
      const [, op, value] = opMatch
      const opLower = op.toLowerCase()

      if (!VALID_OPERATORS.includes(opLower)) {
        errors.push({
          position,
          message: `Unknown operator: ${op}`,
          token,
        })
      } else {
        switch (opLower) {
          case 'tag': {
            operators.push({ type: 'tag', value })
            break
          }

          case 'from': {
            const date = parseDate(value)
            if (date) {
              operators.push({ type: 'from', value: date })
            } else {
              errors.push({
                position,
                message: `Invalid date format: ${value}. Use YYYY-MM-DD`,
                token,
              })
            }
            break
          }

          case 'to': {
            const date = parseDate(value)
            if (date) {
              operators.push({ type: 'to', value: date })
            } else {
              errors.push({
                position,
                message: `Invalid date format: ${value}. Use YYYY-MM-DD`,
                token,
              })
            }
            break
          }

          case 'age': {
            const days = parseAge(value)
            if (days !== null) {
              operators.push({ type: 'age', value: days })
            } else {
              errors.push({
                position,
                message: `Invalid age format: ${value}. Use number + d/w/m (e.g., 90d, 2w, 3m)`,
                token,
              })
            }
            break
          }

          case 'status': {
            const statusLower = value.toLowerCase() as NoteDataStatus
            if (VALID_STATUSES.includes(statusLower)) {
              operators.push({ type: 'status', value: statusLower })
            } else {
              errors.push({
                position,
                message: `Invalid status: ${value}. Use complete, incomplete, or unset`,
                token,
              })
            }
            break
          }

          case 'has': {
            const hasLower = value.toLowerCase() as Exclude<NoteDataType, 'tag'>
            if (VALID_HAS_VALUES.includes(hasLower)) {
              operators.push({ type: 'has', value: hasLower })
            } else {
              errors.push({
                position,
                message: `Invalid has value: ${value}. Use timer, task, or pin`,
                token,
              })
            }
            break
          }

          case 'doc': {
            operators.push({ type: 'doc', value })
            break
          }
        }
      }
    } else {
      // Bare text - full-text search
      // Strip quotes if present
      let text = token.replace(/^"|"$/g, '')
      if (text) {
        // Detect wildcard patterns:
        // run* = prefix (words starting with "run")
        // *ing = suffix (words ending with "ing")
        // *run* = none/contains (default)
        // run = exact word match when no wildcards
        let wildcard: 'none' | 'prefix' | 'suffix' | 'exact' = 'none'

        if (text.startsWith('*') && text.endsWith('*')) {
          // *run* = contains (same as default)
          text = text.slice(1, -1)
          wildcard = 'none'
        } else if (text.endsWith('*')) {
          // run* = prefix match
          text = text.slice(0, -1)
          wildcard = 'prefix'
        } else if (text.startsWith('*')) {
          // *ing = suffix match
          text = text.slice(1)
          wildcard = 'suffix'
        } else {
          // no wildcards = contains match (most intuitive default)
          wildcard = 'none'
        }

        if (text) {
          operators.push({ type: 'text', value: text, wildcard })
        }
      }
    }

    position += token.length + 1 // +1 for space
  }

  return { operators, errors }
}

// Serialize operators back to query string (for saving searches)
export function serializeQuery(operators: SearchOperator[]): string {
  return operators
    .map((op) => {
      switch (op.type) {
        case 'tag':
          // Tags are stored with # prefix, output as #tagname
          return op.value.startsWith('#') ? op.value : `#${op.value}`
        case 'from':
          return `from:${formatDate(op.value)}`
        case 'to':
          return `to:${formatDate(op.value)}`
        case 'age':
          return `age:${op.value}d`
        case 'status':
          return `status:${op.value}`
        case 'has':
          return `has:${op.value}`
        case 'doc':
          return `doc:${op.value}`
        case 'text': {
          let text = op.value
          // Re-add wildcards for serialization
          if (op.wildcard === 'prefix') text = `${text}*`
          else if (op.wildcard === 'suffix') text = `*${text}`
          return text.includes(' ') ? `"${text}"` : text
        }
      }
    })
    .join(' ')
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
