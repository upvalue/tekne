import { sql, type ExpressionBuilder, type Kysely } from 'kysely'
import type { Database } from '@/db'
import type { NoteDataType } from '@/db/types'

/**
 * Per-tag totals over note_data.
 *
 * The page_* fields are the same figures narrowed to the document being
 * viewed; only the page-scoped aggregate fills them in.
 */
export type TagAggregateData = {
  tag: string
  complete_tasks: number
  incomplete_tasks: number
  unset_tasks: number
  total_time_seconds: number
  pinned_at: Date | null
  pinned_desc: string | null
  page_complete_tasks?: number
  page_incomplete_tasks?: number
  page_unset_tasks?: number
  page_time_seconds?: number
}

export type TagAggregateFilters = {
  fromDate?: Date
  toDate?: Date
  /** ILIKE pattern matched against note_title */
  docPattern?: string
  /** Narrow to exactly one document */
  docTitle?: string
  /**
   * Leave out documents whose title starts with '$'.
   *
   * Templates hold sample data, so they pad any total that spans documents --
   * including the pin totals, which is where this used to be forgotten. A
   * caller already narrowed to one document passes false: naming the document
   * answers the question, and a template's own page would otherwise report
   * nothing about itself.
   */
  excludeTemplates: boolean
}

const emptyAggregate = (tag: string): TagAggregateData => ({
  tag,
  complete_tasks: 0,
  incomplete_tasks: 0,
  unset_tasks: 0,
  total_time_seconds: 0,
  pinned_at: null,
  pinned_desc: null,
})

/** True once a tag has anything worth showing a card for. */
export const hasAggregateData = (row: TagAggregateData): boolean =>
  row.complete_tasks > 0 ||
  row.incomplete_tasks > 0 ||
  row.unset_tasks > 0 ||
  row.total_time_seconds > 0 ||
  row.pinned_at !== null ||
  (row.page_complete_tasks ?? 0) > 0 ||
  (row.page_incomplete_tasks ?? 0) > 0 ||
  (row.page_unset_tasks ?? 0) > 0 ||
  (row.page_time_seconds ?? 0) > 0

/**
 * The filter block every one of the queries below shares. Kept as one
 * expression so the four of them cannot drift apart again.
 */
const matching = (
  eb: ExpressionBuilder<Database, 'note_data'>,
  datumType: NoteDataType,
  tags: string[],
  filters: TagAggregateFilters
) => {
  const conditions = [
    eb('datum_type', '=', datumType),
    eb('datum_tag', 'in', tags),
  ]

  if (filters.excludeTemplates) {
    conditions.push(eb('note_title', 'not ilike', '$%'))
  }
  if (filters.docTitle) {
    conditions.push(eb('note_title', '=', filters.docTitle))
  }
  if (filters.docPattern) {
    conditions.push(eb('note_title', 'ilike', filters.docPattern))
  }
  if (filters.fromDate) {
    conditions.push(eb('time_created', '>=', filters.fromDate))
  }
  if (filters.toDate) {
    conditions.push(eb('time_created', '<', filters.toDate))
  }

  return eb.and(conditions)
}

/**
 * Task counts, timer totals and the most recent pin for each of `tags`.
 *
 * Every requested tag gets an entry, zero-filled when it has no data, so
 * callers can look tags up without checking for undefined.
 */
export const aggregateTagData = async (
  db: Kysely<Database>,
  tags: string[],
  filters: TagAggregateFilters,
  { withPins = true }: { withPins?: boolean } = {}
): Promise<Map<string, TagAggregateData>> => {
  const results = new Map(tags.map((tag) => [tag, emptyAggregate(tag)]))

  if (tags.length === 0) {
    return results
  }

  const [taskRows, timerRows, pinRows] = await Promise.all([
    db
      .selectFrom('note_data')
      // The ::int casts matter: COUNT and SUM come back as bigint, which the
      // driver hands over as a string, and these have always been typed as
      // numbers.
      .select([
        'datum_tag as tag',
        sql<number>`COUNT(CASE WHEN datum_status = 'complete' THEN 1 END)::int`.as(
          'complete_tasks'
        ),
        sql<number>`COUNT(CASE WHEN datum_status = 'incomplete' THEN 1 END)::int`.as(
          'incomplete_tasks'
        ),
        sql<number>`COUNT(CASE WHEN datum_status = 'unset' OR datum_status IS NULL THEN 1 END)::int`.as(
          'unset_tasks'
        ),
      ])
      .where((eb) => matching(eb, 'task', tags, filters))
      .groupBy('datum_tag')
      .execute(),

    db
      .selectFrom('note_data')
      .select([
        'datum_tag as tag',
        sql<number>`COALESCE(SUM(datum_time_seconds), 0)::int`.as(
          'total_time_seconds'
        ),
      ])
      .where((eb) => matching(eb, 'timer', tags, filters))
      .groupBy('datum_tag')
      .execute(),

    withPins
      ? db
          .selectFrom('note_data')
          .select([
            'datum_tag as tag',
            'datum_pinned_at',
            'datum_pinned_content',
          ])
          .where((eb) => matching(eb, 'pin', tags, filters))
          // An unpinned row would sort first under DESC, so drop those rather
          // than let one beat a real pin.
          .where('datum_pinned_at', 'is not', null)
          .distinctOn('datum_tag')
          .orderBy('datum_tag')
          .orderBy('datum_pinned_at', 'desc')
          .execute()
      : Promise.resolve([]),
  ])

  for (const row of taskRows) {
    const aggregate = results.get(row.tag)
    if (!aggregate) continue
    aggregate.complete_tasks = row.complete_tasks
    aggregate.incomplete_tasks = row.incomplete_tasks
    aggregate.unset_tasks = row.unset_tasks
  }

  for (const row of timerRows) {
    const aggregate = results.get(row.tag)
    if (!aggregate) continue
    aggregate.total_time_seconds = row.total_time_seconds
  }

  for (const row of pinRows) {
    const aggregate = results.get(row.tag)
    if (!aggregate) continue
    aggregate.pinned_at = row.datum_pinned_at
    aggregate.pinned_desc = row.datum_pinned_content
  }

  return results
}
