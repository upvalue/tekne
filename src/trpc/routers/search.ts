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
  z.object({ type: z.literal('text'), value: z.string() }),
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

      // Start with base query joining notes and note_data
      let query = db
        .selectFrom('notes')
        .innerJoin('note_data', 'notes.title', 'note_data.note_title')
        .select([
          'notes.title as note_title',
          'note_data.line_idx',
          'note_data.time_created',
          'note_data.datum_type',
          'note_data.datum_tag',
          'note_data.datum_status',
        ])
        // Exclude templates
        .where('notes.title', 'not ilike', '$%')
        .orderBy('note_data.time_created', 'desc')
        .limit(limit + 1) // +1 to check if there's more

      if (cursor) {
        query = query.offset(cursor)
      }

      // Apply operators as filters
      for (const op of operators as SearchOperator[]) {
        switch (op.type) {
          case 'tag':
            // Prefix match for tags
            query = query.where('note_data.datum_tag', 'ilike', `${op.value}%`)
            break

          case 'from':
            query = query.where('note_data.time_created', '>=', op.value)
            break

          case 'to': {
            // Add one day to include the end date
            const toDate = new Date(op.value)
            toDate.setDate(toDate.getDate() + 1)
            query = query.where('note_data.time_created', '<', toDate)
            break
          }

          case 'age': {
            const cutoff = new Date()
            cutoff.setDate(cutoff.getDate() - op.value)
            query = query.where('note_data.time_created', '>=', cutoff)
            break
          }

          case 'status':
            query = query
              .where('note_data.datum_type', '=', 'task')
              .where('note_data.datum_status', '=', op.value)
            break

          case 'has':
            query = query.where('note_data.datum_type', '=', op.value)
            break

          case 'doc':
            query = query.where('notes.title', 'ilike', globToLike(op.value))
            break

          case 'text':
            // Full-text search in parsed_body using JSON
            query = query.where(
              sql`notes.parsed_body::text`,
              'ilike',
              `%${op.value}%`
            )
            break
        }
      }

      const results = await query.execute()

      // Check if there are more results
      const hasMore = results.length > limit
      const items = hasMore ? results.slice(0, limit) : results

      // Get unique lines by note_title + line_idx
      const uniqueLines = new Map<
        string,
        {
          note_title: string
          line_idx: number
          time_created: Date
          tags: string[]
          has_timer: boolean
          has_task: boolean
          task_status: string | null
        }
      >()

      for (const row of items) {
        const key = `${row.note_title}:${row.line_idx}`
        const existing = uniqueLines.get(key)

        if (!existing) {
          uniqueLines.set(key, {
            note_title: row.note_title,
            line_idx: row.line_idx,
            time_created: row.time_created,
            tags: row.datum_type === 'tag' ? [row.datum_tag] : [],
            has_timer: row.datum_type === 'timer',
            has_task: row.datum_type === 'task',
            task_status: row.datum_type === 'task' ? row.datum_status : null,
          })
        } else {
          if (
            row.datum_type === 'tag' &&
            !existing.tags.includes(row.datum_tag)
          ) {
            existing.tags.push(row.datum_tag)
          }
          if (row.datum_type === 'timer') existing.has_timer = true
          if (row.datum_type === 'task') {
            existing.has_task = true
            existing.task_status = row.datum_status
          }
        }
      }

      // Get line content from parsed_body for each unique line
      const lineResults = []
      for (const line of uniqueLines.values()) {
        // Fetch the line content from parsed_body
        const note = await db
          .selectFrom('notes')
          .select(['parsed_body'])
          .where('title', '=', line.note_title)
          .executeTakeFirst()

        let content = ''
        if (note?.parsed_body && Array.isArray(note.parsed_body)) {
          const lineData = note.parsed_body[line.line_idx]
          if (lineData && typeof lineData === 'object' && 'raw' in lineData) {
            content = lineData.raw as string
          }
        }

        lineResults.push({
          ...line,
          content,
        })
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

      // Apply tag prefix filter
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
