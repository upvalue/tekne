// Shared translation of search-language operators into SQL predicates, used
// by both the line search and the aggregate search so the two views cannot
// drift apart in how they read a query.
import type { SearchOperator } from '@/search/types'

/**
 * Escape LIKE/ILIKE wildcards so user input matches literally. Postgres's
 * default escape character for LIKE is backslash, so no ESCAPE clause is
 * needed.
 */
export const escapeLike = (value: string): string =>
  value.replace(/[\\%_]/g, '\\$&')

/** Convert a user glob (`*`/`?`) to a LIKE pattern, escaping literal `%`/`_`. */
export const globToLike = (pattern: string): string =>
  escapeLike(pattern).replace(/\*/g, '%').replace(/\?/g, '_')

/** `to:` is inclusive of the named day, so the SQL bound is the next day. */
export const toDateExclusive = (value: Date): Date => {
  const toDate = new Date(value)
  toDate.setDate(toDate.getDate() + 1)
  return toDate
}

/** `age:` N days means "created on or after N days ago". */
export const ageCutoff = (days: number): Date => {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return cutoff
}

/** Build the pattern for a `text:` operator based on its wildcard mode. */
export const buildTextCondition = (
  value: string,
  wildcard: string
): { pattern: string; useRegex: boolean } => {
  // Escape special regex characters in the value
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  switch (wildcard) {
    case 'prefix':
      // Word starting with value: \m = word boundary start
      return { pattern: `\\m${escaped}`, useRegex: true }
    case 'suffix':
      // Word ending with value: \M = word boundary end
      return { pattern: `${escaped}\\M`, useRegex: true }
    case 'exact':
      // Exact word: both boundaries
      return { pattern: `\\m${escaped}\\M`, useRegex: true }
    case 'none':
    default:
      // Contains anywhere (simple ILIKE)
      return { pattern: `%${escapeLike(value)}%`, useRegex: false }
  }
}

/**
 * Operators the aggregate view cannot honor: they filter individual lines,
 * while aggregates are computed over every line a tag touches. Rejecting them
 * loudly beats silently returning unfiltered totals.
 */
export const unsupportedAggregateOperators = (
  operators: SearchOperator[]
): string[] => [
  ...new Set(
    operators
      .filter(
        (op) => op.type === 'status' || op.type === 'has' || op.type === 'text'
      )
      .map((op) => op.type)
  ),
]
