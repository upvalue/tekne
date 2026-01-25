// search.ts - TRPC router for search functionality
import { z } from 'zod'
import { sql } from 'kysely'
import { t } from '../init'
import type { SearchOperator } from '@/search/types'

// Zod schemas for search operators
const searchOperatorSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('tag'), value: z.string() }),
  z.object({ type: z.literal('from'), value: z.coerce.date() }),
  z.object({ type: z.literal('to'), value: z.coerce.date() }),
  z.object({ type: z.literal('age'), value: z.number() }),
  z.object({
    type: z.literal('status'),
    value: z.enum(['complete', 'incomplete', 'unset']),
  }),
  z.object({
    type: z.literal('has'),
    value: z.enum(['timer', 'task', 'pin']),
  }),
  z.object({ type: z.literal('doc'), value: z.string() }),
  z.object({
    type: z.literal('text'),
    value: z.string(),
    wildcard: z.enum(['none', 'prefix', 'suffix', 'exact']),
  }),
])

type TagAggregateData = {
  tag: string
  complete_tasks: number
  incomplete_tasks: number
  unset_tasks: number
  total_time_seconds: number
  pinned_at: Date | null
  pinned_desc: string | null
}

// Convert glob pattern to SQL LIKE pattern
function globToLike(pattern: string): string {
  return pattern.replace(/\*/g, '%').replace(/\?/g, '_')
}

// Helper to build common filter conditions
function buildFilterConditions(operators: SearchOperator[]) {
  const conditions: {
    fromDate?: Date
    toDate?: Date
    docPattern?: string
    tagPrefix?: string
  } = {}

  for (const op of operators) {
    switch (op.type) {
      case 'tag':
        conditions.tagPrefix = op.value
        break
      case 'from':
        conditions.fromDate = op.value
        break
      case 'to': {
        const toDate = new Date(op.value)
        toDate.setDate(toDate.getDate() + 1)
        conditions.toDate = toDate
        break
      }
      case 'age': {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - op.value)
        conditions.fromDate = cutoff
        break
      }
      case 'doc':
        conditions.docPattern = globToLike(op.value)
        break
    }
  }

  return conditions
}

// Helper to build text search condition based on wildcard type
function buildTextCondition(value: string, wildcard: string) {
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
      return { pattern: `%${value}%`, useRegex: false }
  }
}

export const searchRouter = t.router({
  /**
   * Search for lines matching the query operators
   */
  searchLines: t.procedure
    .input(
      z.object({
        operators: z.array(searchOperatorSchema),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(),
      })
    )
    .query(async ({ input, ctx: { db } }) => {
      const { operators, limit, cursor } = input

      // Determine if we need datum filters (tag, status, has)
      const hasDatumFilters = operators.some((op) =>
        ['tag', 'status', 'has'].includes(op.type)
      )

      // Determine if we have text search
      const hasTextSearch = operators.some((op) => op.type === 'text')

      // Base query starts from note_lines (has all lines)
      let query = db
        .selectFrom('note_lines')
        .select([
          'note_lines.note_title',
          'note_lines.line_idx',
          'note_lines.content',
          'note_lines.indent',
          'note_lines.time_created',
          'note_lines.time_updated',
        ])
        // Exclude templates
        .where('note_lines.note_title', 'not ilike', '$%')
        .orderBy('note_lines.time_created', 'desc')
        .limit(limit + 1)

      if (cursor) {
        query = query.offset(cursor)
      }

      // Apply non-datum filters first (these work on note_lines directly)
      for (const op of operators as SearchOperator[]) {
        switch (op.type) {
          case 'from':
            query = query.where('note_lines.time_created', '>=', op.value)
            break

          case 'to': {
            const toDate = new Date(op.value)
            toDate.setDate(toDate.getDate() + 1)
            query = query.where('note_lines.time_created', '<', toDate)
            break
          }

          case 'age': {
            const cutoff = new Date()
            cutoff.setDate(cutoff.getDate() - op.value)
            query = query.where('note_lines.time_created', '>=', cutoff)
            break
          }

          case 'doc':
            query = query.where(
              'note_lines.note_title',
              'ilike',
              globToLike(op.value)
            )
            break

          case 'text': {
            const { pattern, useRegex } = buildTextCondition(
              op.value,
              op.wildcard
            )
            if (useRegex) {
              // Use case-insensitive regex for word boundary matching
              query = query.where(sql`note_lines.content`, '~*', pattern)
            } else {
              // Use ILIKE for simple contains
              query = query.where('note_lines.content', 'ilike', pattern)
            }
            break
          }
        }
      }

      // If we have datum filters, use EXISTS subquery to filter
      if (hasDatumFilters) {
        query = query.where(({ exists, selectFrom }) => {
          let subquery = selectFrom('note_data')
            .select(sql`1`.as('one'))
            .whereRef('note_data.note_title', '=', 'note_lines.note_title')
            .whereRef('note_data.line_idx', '=', 'note_lines.line_idx')

          // Apply datum-specific filters to subquery
          for (const op of operators as SearchOperator[]) {
            switch (op.type) {
              case 'tag':
                subquery = subquery.where(
                  'note_data.datum_tag',
                  'ilike',
                  `${op.value}%`
                )
                break

              case 'status':
                subquery = subquery
                  .where('note_data.datum_type', '=', 'task')
                  .where('note_data.datum_status', '=', op.value)
                break

              case 'has':
                subquery = subquery.where('note_data.datum_type', '=', op.value)
                break
            }
          }

          return exists(subquery)
        })
      }

      const results = await query.execute()

      // Check if there are more results
      const hasMore = results.length > limit
      const items = hasMore ? results.slice(0, limit) : results

      // Deduplicate lines (datum joins can cause multiple rows per line)
      const uniqueLines = new Map<
        string,
        {
          note_title: string
          line_idx: number
          content: string
          indent: number
          time_created: Date | null
        }
      >()

      for (const row of items) {
        const key = `${row.note_title}:${row.line_idx}`
        if (!uniqueLines.has(key)) {
          uniqueLines.set(key, {
            note_title: row.note_title,
            line_idx: row.line_idx,
            content: row.content,
            indent: row.indent,
            time_created: row.time_created,
          })
        }
      }

      // Get datum info and child counts from notes.body
      // Group by note_title to batch fetches
      const notesByTitle = new Map<
        string,
        Array<{ key: string; line_idx: number }>
      >()
      for (const [key, line] of uniqueLines) {
        if (!notesByTitle.has(line.note_title)) {
          notesByTitle.set(line.note_title, [])
        }
        notesByTitle.get(line.note_title)!.push({ key, line_idx: line.line_idx })
      }

      const lineResults = []
      for (const [noteTitle, lineRefs] of notesByTitle) {
        const note = await db
          .selectFrom('notes')
          .select(['body'])
          .where('title', '=', noteTitle)
          .executeTakeFirst()

        if (!note?.body?.children) continue

        for (const { key, line_idx } of lineRefs) {
          const line = uniqueLines.get(key)!
          const lineData = note.body.children[line_idx]
          if (!lineData) continue

          // Count child lines (lines with greater indent that follow)
          let childCount = 0
          const baseIndent = lineData.indent
          for (let i = line_idx + 1; i < note.body.children.length; i++) {
            const child = note.body.children[i]
            if (child.indent > baseIndent) {
              childCount++
            } else {
              break
            }
          }

          // Get tags for this line
          const tags: string[] = []
          // We could query note_data here, but for now just extract from content
          const tagMatches = line.content.match(/#[a-zA-Z][a-zA-Z0-9-/]*/g)
          if (tagMatches) {
            tags.push(...tagMatches)
          }

          lineResults.push({
            note_title: line.note_title,
            line_idx: line.line_idx,
            time_created: line.time_created,
            tags,
            content: line.content,
            indent: line.indent,
            datum_task_status: lineData.datumTaskStatus || null,
            datum_time_seconds: lineData.datumTimeSeconds ?? null,
            datum_pinned_at: lineData.datumPinnedAt || null,
            child_count: childCount,
          })
        }
      }

      return {
        items: lineResults,
        nextCursor: hasMore ? (cursor || 0) + limit : undefined,
      }
    }),

  /**
   * Get aggregate stats for tags matching the query
   */
  searchAggregate: t.procedure
    .input(
      z.object({
        operators: z.array(searchOperatorSchema),
      })
    )
    .query(async ({ input, ctx: { db } }): Promise<TagAggregateData[]> => {
      const { operators } = input
      const filters = buildFilterConditions(operators as SearchOperator[])

      // First, find all matching tags
      let tagQuery = db
        .selectFrom('note_data')
        .select(['datum_tag as tag'])
        .where('datum_type', '=', 'tag')
        // Exclude templates
        .where('note_title', 'not ilike', '$%')
        .distinct()

      // Apply tag prefix filter (value already includes # prefix)
      if (filters.tagPrefix) {
        tagQuery = tagQuery.where(
          'datum_tag',
          'ilike',
          `${filters.tagPrefix}%`
        )
      }

      // Apply date filters to tag query
      if (filters.fromDate) {
        tagQuery = tagQuery.where('time_created', '>=', filters.fromDate)
      }
      if (filters.toDate) {
        tagQuery = tagQuery.where('time_created', '<', filters.toDate)
      }
      if (filters.docPattern) {
        tagQuery = tagQuery.where('note_title', 'ilike', filters.docPattern)
      }

      const tags = await tagQuery.execute()

      if (tags.length === 0) {
        return []
      }

      const tagNames = tags.map((t) => t.tag)

      // Build task query with same filters
      let taskQuery = db
        .selectFrom('note_data')
        .select([
          'datum_tag as tag',
          sql<number>`COUNT(CASE WHEN datum_status = 'complete' THEN 1 END)`.as(
            'complete_tasks'
          ),
          sql<number>`COUNT(CASE WHEN datum_status = 'incomplete' THEN 1 END)`.as(
            'incomplete_tasks'
          ),
          sql<number>`COUNT(CASE WHEN datum_status = 'unset' OR datum_status IS NULL THEN 1 END)`.as(
            'unset_tasks'
          ),
        ])
        .where('note_title', 'not ilike', '$%')
        .where('datum_type', '=', 'task')
        .where('datum_tag', 'in', tagNames)

      // Apply same date/doc filters to task data
      if (filters.fromDate) {
        taskQuery = taskQuery.where('time_created', '>=', filters.fromDate)
      }
      if (filters.toDate) {
        taskQuery = taskQuery.where('time_created', '<', filters.toDate)
      }
      if (filters.docPattern) {
        taskQuery = taskQuery.where('note_title', 'ilike', filters.docPattern)
      }

      const taskData = await taskQuery.groupBy('datum_tag').execute()

      // Build timer query with same filters
      let timerQuery = db
        .selectFrom('note_data')
        .select([
          'datum_tag as tag',
          sql<number>`SUM(datum_time_seconds)`.as('total_time_seconds'),
        ])
        .where('note_title', 'not ilike', '$%')
        .where('datum_type', '=', 'timer')
        .where('datum_tag', 'in', tagNames)

      // Apply same date/doc filters to timer data
      if (filters.fromDate) {
        timerQuery = timerQuery.where('time_created', '>=', filters.fromDate)
      }
      if (filters.toDate) {
        timerQuery = timerQuery.where('time_created', '<', filters.toDate)
      }
      if (filters.docPattern) {
        timerQuery = timerQuery.where('note_title', 'ilike', filters.docPattern)
      }

      const timerData = await timerQuery.groupBy('datum_tag').execute()

      // Build pin query with same filters
      let pinQuery = db
        .selectFrom('note_data')
        .select(['datum_tag as tag', 'datum_pinned_at', 'datum_pinned_content'])
        .where('datum_type', '=', 'pin')
        .where('datum_tag', 'in', tagNames)
        .orderBy('datum_pinned_at', 'desc')

      // Apply same date/doc filters to pin data
      if (filters.fromDate) {
        pinQuery = pinQuery.where('time_created', '>=', filters.fromDate)
      }
      if (filters.toDate) {
        pinQuery = pinQuery.where('time_created', '<', filters.toDate)
      }
      if (filters.docPattern) {
        pinQuery = pinQuery.where('note_title', 'ilike', filters.docPattern)
      }

      const pinData = await pinQuery.execute()

      // Combine results
      const results: { [tag: string]: TagAggregateData } = {}

      for (const tag of tagNames) {
        results[tag] = {
          tag,
          complete_tasks: 0,
          incomplete_tasks: 0,
          unset_tasks: 0,
          total_time_seconds: 0,
          pinned_at: null,
          pinned_desc: null,
        }
      }

      for (const task of taskData) {
        if (results[task.tag]) {
          results[task.tag].complete_tasks = task.complete_tasks
          results[task.tag].incomplete_tasks = task.incomplete_tasks
          results[task.tag].unset_tasks = task.unset_tasks
        }
      }

      for (const timer of timerData) {
        if (results[timer.tag]) {
          results[timer.tag].total_time_seconds = timer.total_time_seconds
        }
      }

      for (const pin of pinData) {
        if (results[pin.tag] && !results[pin.tag].pinned_at) {
          results[pin.tag].pinned_at = pin.datum_pinned_at ?? null
          results[pin.tag].pinned_desc = pin.datum_pinned_content
        }
      }

      return Object.values(results).sort((a, b) => a.tag.localeCompare(b.tag))
    }),

  /**
   * Get all saved searches
   */
  getSavedSearches: t.procedure.query(async ({ ctx: { db } }) => {
    return db
      .selectFrom('saved_searches')
      .selectAll()
      .orderBy('updated_at', 'desc')
      .execute()
  }),

  /**
   * Save a new search
   */
  saveSearch: t.procedure
    .input(
      z.object({
        name: z.string().min(1),
        query: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx: { db } }) => {
      const result = await db
        .insertInto('saved_searches')
        .values({
          name: input.name,
          query: input.query,
        })
        .returning(['id', 'name', 'query', 'created_at', 'updated_at'])
        .executeTakeFirstOrThrow()

      return result
    }),

  /**
   * Delete a saved search
   */
  deleteSavedSearch: t.procedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx: { db } }) => {
      await db
        .deleteFrom('saved_searches')
        .where('id', '=', input.id)
        .execute()

      return { success: true }
    }),
})
