import { sql, type Kysely, type RawBuilder } from 'kysely'
import type { Database } from '@/db/types'
import type { ReportOperator } from '@/search/report-query'
import { buildTextCondition, escapeLike, globToLike } from './search-operators'

const calendarDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** A single relation of unique lines backs both pages and complete summaries. */
function matchingReportLines(
  operators: ReportOperator[],
  timezone: string,
  now: Date
) {
  const conditions: RawBuilder<boolean>[] = [sql`n.title not ilike '$%'`]
  const line = sql`n.body->'children'->l.line_idx`
  for (const op of operators) {
    switch (op.type) {
      case 'tag':
        conditions.push(
          sql`exists (select 1 from note_data d where d.line_id = l.line_id and d.note_title = l.note_title and d.datum_type = 'tag' and d.datum_tag ilike ${escapeLike(op.value) + '%'})`
        )
        break
      case 'doc':
        conditions.push(sql`n.title ilike ${globToLike(op.value)}`)
        break
      case 'text': {
        const { pattern, useRegex } = buildTextCondition(op.value, op.wildcard)
        conditions.push(
          useRegex
            ? sql`l.content ~* ${pattern}`
            : sql`l.content ilike ${pattern}`
        )
        break
      }
      case 'status':
        conditions.push(sql`${line}->>'datumTaskStatus' = ${op.value}`)
        break
      case 'has': {
        const key = {
          timer: 'datumTimeSeconds',
          task: 'datumTaskStatus',
          pin: 'datumPinnedAt',
        }[op.value]
        conditions.push(sql`${line}->>${key} is not null`)
        break
      }
      case 'from':
        conditions.push(
          sql`l.time_created >= (${calendarDate(op.value)}::date::timestamp at time zone ${timezone})`
        )
        break
      case 'to':
        conditions.push(
          sql`l.time_created < ((${calendarDate(op.value)}::date + 1)::timestamp at time zone ${timezone})`
        )
        break
      case 'age':
        conditions.push(
          sql`l.time_created >= ${new Date(now.getTime() - op.value * 86400000)}`
        )
        break
      case 'day': {
        const column =
          op.field === 'created' ? sql`l.time_created` : sql`l.time_updated`
        conditions.push(
          sql`${column} >= (${op.from}::date::timestamp at time zone ${timezone}) and ${column} < ((${op.to}::date + 1)::timestamp at time zone ${timezone})`
        )
        break
      }
    }
  }
  return sql`select l.line_id as "lineId", l.note_title as document, l.line_idx as "lineIndex",
    l.content, l.indent, l.time_created as "timeCreated", l.time_updated as "timeUpdated",
    ${line}->>'datumTaskStatus' as "taskStatus",
    (${line}->>'datumTimeSeconds')::double precision as "timeSeconds",
    array(select distinct d.datum_tag from note_data d where d.line_id = l.line_id and d.note_title = l.note_title and d.datum_type = 'tag' order by d.datum_tag) as tags
    from note_lines l join notes n on n.title = l.note_title
    where ${sql.join(conditions, sql` and `)}`
}

export async function searchReport(
  db: Kysely<Database>,
  input: {
    operators: ReportOperator[]
    timezone: string
    now: Date
    limit: number
    cursor: number
    summaryOnly: boolean
    groupBy?: 'tag' | 'document'
  }
) {
  const matching = matchingReportLines(
    input.operators,
    input.timezone,
    input.now
  )
  // One statement gives the page, totals and groups the same database snapshot.
  const grouping =
    input.groupBy === 'tag'
      ? sql`select tag as key, count(*)::int as "matchedCount", coalesce(sum("timeSeconds"), 0)::double precision as "timeSeconds" from matched left join lateral unnest(tags) tag on true group by tag order by tag nulls last`
      : input.groupBy === 'document'
        ? sql`select document as key, count(*)::int as "matchedCount", coalesce(sum("timeSeconds"), 0)::double precision as "timeSeconds" from matched group by document order by document`
        : sql`select null::text as key, 0 as "matchedCount", 0 as "timeSeconds" where false`
  const result = await sql<{
    items: Array<{
      lineId: string
      document: string
      lineIndex: number
      content: string
      indent: number
      timeCreated: string | null
      timeUpdated: string | null
      taskStatus: 'complete' | 'incomplete' | 'unset' | null
      timeSeconds: number | null
      tags: string[]
    }>
    summary: {
      matchedCount: number
      timedEntryCount: number
      timeSeconds: number
    }
    groups: Array<{
      key: string | null
      matchedCount: number
      timeSeconds: number
    }>
    groupsOverlap: boolean
  }>`with matched as (${matching}), page as (
    select * from matched order by "timeCreated" desc nulls last, document, "lineIndex"
    limit ${input.summaryOnly ? 0 : input.limit + 1} offset ${input.cursor}
  ), groups as (${grouping})
  select
    coalesce((select jsonb_agg(page) from page), '[]'::jsonb) as items,
    (select jsonb_build_object('matchedCount', count(*), 'timedEntryCount', count("timeSeconds"), 'timeSeconds', coalesce(sum("timeSeconds"), 0)) from matched) as summary,
    coalesce((select jsonb_agg(groups) from groups), '[]'::jsonb) as groups,
    ${input.groupBy === 'tag'} and exists(select 1 from matched where cardinality(tags) > 1) as "groupsOverlap"
  `.execute(db)
  const row = result.rows[0]
  const hasMore = row.items.length > input.limit
  return {
    ...row,
    items: row.items.slice(0, input.limit),
    nextCursor: hasMore ? input.cursor + input.limit : null,
  }
}
