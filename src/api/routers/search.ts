import { outputs } from '../outputs'
import { z } from 'zod'
import { sql } from 'kysely'
import { ORPCError } from '@orpc/server'
import { proc } from '../init'
import { parseReportQuery } from '@/search/report-query'
import { searchReport } from '../lib/search-report'
import type { SearchOperator } from '@/search/types'
import { TAG_REGEX_MATCH_BEFORE_STR } from '@/docs/regex'
import { aggregateTagData, type TagAggregateData } from '../lib/tag-aggregates'
import {
  ageCutoff,
  buildTextCondition,
  escapeLike,
  globToLike,
  toDateExclusive,
  unsupportedAggregateOperators,
} from '../lib/search-operators'

const TAG_IN_CONTENT_REGEX = new RegExp(TAG_REGEX_MATCH_BEFORE_STR, 'g')

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
      case 'to':
        conditions.toDate = toDateExclusive(op.value)
        break
      case 'age':
        conditions.fromDate = ageCutoff(op.value)
        break
      case 'doc':
        conditions.docPattern = globToLike(op.value)
        break
    }
  }

  return conditions
}

export const searchRouter = {
  query: proc
    .route({
      method: 'POST',
      path: '/search/query',
      tags: ['search'],
      summary: 'Search and summarize entries',
      description:
        'Search query text with tags, text, doc globs, status, has, from/to/age and created/updated dates. today/yesterday resolve in timezone. Summaries cover all matches, including untagged entries, independently of pagination. Tag groups may overlap.',
    })
    .input(
      z.object({
        query: z.string(),
        timezone: z.string().default('UTC'),
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.number().int().nonnegative().default(0),
        summaryOnly: z.boolean().default(false),
        groupBy: z.enum(['tag', 'document']).optional(),
      })
    )
    .output(outputs.search.query)
    .handler(async ({ input, context: { db } }) => {
      const now = new Date()
      let parsed: ReturnType<typeof parseReportQuery>
      try {
        parsed = parseReportQuery(input.query, input.timezone, now)
      } catch (error) {
        throw new ORPCError('BAD_REQUEST', {
          message: error instanceof Error ? error.message : 'Invalid query',
        })
      }
      return {
        query: input.query,
        timezone: input.timezone,
        today: parsed.today,
        asOf: now.toISOString(),
        groupBy: input.groupBy ?? null,
        ...(await searchReport(db, {
          ...input,
          operators: parsed.operators,
          now,
        })),
      }
    }),
  /** Search for lines matching the query operators. */
  searchLines: proc
    .route({
      method: 'POST',
      path: '/search/lines',
      tags: ['search'],
      summary: 'Search lines',
      description:
        'Search lines using structured operators. Templates are excluded. limit defaults to 50 (maximum 100); pass nextCursor as cursor for the next page.',
    })
    .output(outputs.search.searchLines)
    .input(
      z.object({
        operators: z.array(searchOperatorSchema),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(),
      })
    )
    .handler(async ({ input, context: { db } }) => {
      const { operators, limit, cursor } = input

      const hasDatumFilters = operators.some((op) =>
        ['tag', 'status', 'has'].includes(op.type)
      )

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
        .where('note_lines.note_title', 'not ilike', '$%')
        // Tiebreakers keep the order stable when many lines share a
        // creation timestamp; without them offset pagination can repeat
        // or skip rows across pages.
        .orderBy('note_lines.time_created', 'desc')
        .orderBy('note_lines.note_title')
        .orderBy('note_lines.line_idx')
        .limit(limit + 1)

      if (cursor) {
        query = query.offset(cursor)
      }

      for (const op of operators as SearchOperator[]) {
        switch (op.type) {
          case 'from':
            query = query.where('note_lines.time_created', '>=', op.value)
            break

          case 'to':
            query = query.where(
              'note_lines.time_created',
              '<',
              toDateExclusive(op.value)
            )
            break

          case 'age':
            query = query.where(
              'note_lines.time_created',
              '>=',
              ageCutoff(op.value)
            )
            break

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
              query = query.where(sql`note_lines.content`, '~*', pattern)
            } else {
              query = query.where('note_lines.content', 'ilike', pattern)
            }
            break
          }
        }
      }

      if (hasDatumFilters) {
        query = query.where(({ exists, selectFrom }) => {
          let subquery = selectFrom('note_data')
            .select(sql`1`.as('one'))
            .whereRef('note_data.note_title', '=', 'note_lines.note_title')
            .whereRef('note_data.line_idx', '=', 'note_lines.line_idx')

          for (const op of operators as SearchOperator[]) {
            switch (op.type) {
              case 'tag':
                subquery = subquery.where(
                  'note_data.datum_tag',
                  'ilike',
                  `${escapeLike(op.value)}%`
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

      const hasMore = results.length > limit
      const items = hasMore ? results.slice(0, limit) : results

      // Datum info and child counts come from notes.body; one batched fetch
      // for every note on this page.
      const titles = [...new Set(items.map((row) => row.note_title))]
      const notes =
        titles.length > 0
          ? await db
              .selectFrom('notes')
              .select(['title', 'body'])
              .where('title', 'in', titles)
              .execute()
          : []
      const bodyByTitle = new Map(notes.map((n) => [n.title, n.body]))

      const lineResults = []
      for (const row of items) {
        const children = bodyByTitle.get(row.note_title)?.children
        const lineData = children?.[row.line_idx]
        if (!children || !lineData) continue

        // Count child lines (lines with greater indent that follow)
        let childCount = 0
        for (let i = row.line_idx + 1; i < children.length; i++) {
          if (children[i].indent > lineData.indent) {
            childCount++
          } else {
            break
          }
        }

        lineResults.push({
          note_title: row.note_title,
          line_idx: row.line_idx,
          time_created: row.time_created,
          tags: row.content.match(TAG_IN_CONTENT_REGEX) ?? [],
          content: row.content,
          indent: row.indent,
          datum_task_status: lineData.datumTaskStatus || null,
          datum_time_seconds: lineData.datumTimeSeconds ?? null,
          datum_pinned_at: lineData.datumPinnedAt || null,
          child_count: childCount,
        })
      }

      return {
        items: lineResults,
        nextCursor: hasMore ? (cursor || 0) + limit : undefined,
      }
    }),

  /** Get aggregate statistics for tags matching the query. */
  searchAggregate: proc
    .route({
      method: 'POST',
      path: '/search/aggregates',
      tags: ['search'],
      summary: 'Search aggregate',
      description:
        'Aggregate tags using tag, from, to, age and doc operators. text, status and has filters return 400.',
    })
    .output(outputs.search.searchAggregate)
    .input(
      z.object({
        operators: z.array(searchOperatorSchema),
      })
    )
    .handler(
      async ({ input, context: { db } }): Promise<TagAggregateData[]> => {
        const { operators } = input

        const unsupported = unsupportedAggregateOperators(
          operators as SearchOperator[]
        )
        if (unsupported.length > 0) {
          throw new ORPCError('BAD_REQUEST', {
            message: `The aggregate view cannot filter by ${unsupported
              .map((op) => `"${op}:"`)
              .join(', ')} — switch to the text view for those operators`,
          })
        }

        const filters = buildFilterConditions(operators as SearchOperator[])

        let tagQuery = db
          .selectFrom('note_data')
          .select(['datum_tag as tag'])
          .where('datum_type', '=', 'tag')
          .where('note_title', 'not ilike', '$%')
          .distinct()

        // Apply tag prefix filter (value already includes # prefix)
        if (filters.tagPrefix) {
          tagQuery = tagQuery.where(
            'datum_tag',
            'ilike',
            `${escapeLike(filters.tagPrefix)}%`
          )
        }

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

        const aggregates = await aggregateTagData(db, tagNames, {
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          docPattern: filters.docPattern,
          excludeTemplates: true,
        })

        return [...aggregates.values()].sort((a, b) =>
          a.tag.localeCompare(b.tag)
        )
      }
    ),

  /** Get all saved searches. */
  getSavedSearches: proc
    .route({
      method: 'GET',
      path: '/saved-searches',
      tags: ['search'],
      summary: 'Get saved searches',
      description: 'List saved searches, most recently updated first.',
    })
    .output(outputs.search.getSavedSearches)
    .input(z.object({}).optional())
    .handler(async ({ context: { db } }) => {
      return db
        .selectFrom('saved_searches')
        .selectAll()
        .orderBy('updated_at', 'desc')
        .execute()
    }),

  /** Save a new search. */
  saveSearch: proc
    .route({
      method: 'POST',
      path: '/saved-searches',
      tags: ['search'],
      summary: 'Save search',
      description: 'Save a named search query.',
    })
    .output(outputs.search.saveSearch)
    .input(
      z.object({
        name: z.string().min(1),
        query: z.string().min(1),
      })
    )
    .handler(async ({ input, context: { db } }) => {
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

  /** Delete a saved search. */
  deleteSavedSearch: proc
    .route({
      method: 'DELETE',
      path: '/saved-searches',
      tags: ['search'],
      summary: 'Delete saved search',
      description:
        'Delete a saved search. Send its numeric id in the JSON body.',
    })
    .output(outputs.search.deleteSavedSearch)
    .input(z.object({ id: z.number() }))
    .handler(async ({ input, context: { db } }) => {
      await db.deleteFrom('saved_searches').where('id', '=', input.id).execute()

      return { success: true }
    }),
}
