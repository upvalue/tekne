import type { ZDoc } from '@/docs/schema'
import type { ParsedMdNode } from '@/docs/parser'
import type { ColumnType } from 'kysely'

// Custom column type that handles Zod validation
type ZodJsonColumn<T> = ColumnType<T, T, T>

/**
 * Structure of parsed_body column: an array of parsed line entries.
 * This is stored as JSON.stringify() in the database.
 */
export type ParsedBodyEntry = {
  line_idx: number
  parsed_body: ParsedMdNode
}

export type DBNote = {
  title: string
  body: ZodJsonColumn<ZDoc>
  createdAt: ColumnType<Date, Date | undefined, Date>
  updatedAt: ColumnType<Date, Date | undefined, Date>
  revision: number
  parsed_body: ZodJsonColumn<ParsedBodyEntry[]>
}
export type NoteDataStatus = 'complete' | 'incomplete' | 'unset'
export type NoteDataType = 'task' | 'timer' | 'tag' | 'pin'

export type DBNoteData = {
  line_id: string
  note_title: string
  line_idx: number
  time_created: ColumnType<Date, Date, Date>
  time_updated: ColumnType<Date, Date, Date>
  datum_type: NoteDataType
  datum_tag: string
  datum_status: NoteDataStatus | null
  datum_time_seconds: number | null
  datum_pinned_at: ColumnType<Date, Date | string | undefined, Date> | null
  datum_pinned_content: string | null
}

export type DBSavedSearch = {
  id: ColumnType<number, never, never>
  name: string
  query: string
  created_at: ColumnType<Date, Date | undefined, Date>
  updated_at: ColumnType<Date, Date | undefined, Date>
}

export type DBNoteLine = {
  line_id: string
  note_title: string
  line_idx: number
  content: string
  indent: number
  time_created: ColumnType<Date, Date | undefined, Date> | null
  time_updated: ColumnType<Date, Date | undefined, Date> | null
}

/** Tag metadata; tag_name is stored without the leading '#'. */
export type DBTag = {
  tag_name: string
  description: string | null
  /** Set when the tag is retired: existing occurrences stay, new use is discouraged. */
  archived_at: ColumnType<Date, Date | undefined, Date> | null
  created_at: ColumnType<Date, Date | undefined, Date>
  updated_at: ColumnType<Date, Date | undefined, Date>
}

export type DBFeatureFlag = {
  key: string
  value: ColumnType<unknown, unknown, unknown>
  updated_at: ColumnType<Date, Date | undefined, Date>
}

// Define your database schema interface here
export type Database = {
  timers: DBTimer
  notes: DBNote
  note_data: DBNoteData
  note_lines: DBNoteLine
  saved_searches: DBSavedSearch
  feature_flags: DBFeatureFlag
  tags: DBTag
}

export type DBTimer = {
  id: string
  note_title: string
  line_id: string | null
  line_content: string
  mode: 'stopwatch' | 'countdown'
  time_mode: 'additive' | 'replacement'
  accumulated_ms: number
  running_since: number | null
  target_duration: number
  base_time_seconds: number | null
  completed_at: number | null
  completion_error: 'missing_line' | 'time_changed' | null
  revision: number
}
