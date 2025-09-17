import type { ZDoc } from '@/docs/schema'
import type { ColumnType } from 'kysely'

// Custom column type that handles Zod validation
type ZodJsonColumn<T> = ColumnType<T, T, T>

export type DBNote = {
  title: string
  body: ZodJsonColumn<ZDoc>
  createdAt: ColumnType<Date, Date | undefined, Date>
  updatedAt: ColumnType<Date, Date | undefined, Date>
  revision: number
}
export type NoteDataStatus = 'complete' | 'incomplete' | 'unset'
export type NoteDataType = 'task' | 'timer'

export type DBNoteData = {
  note_title: string
  line_idx: number
  time_created: ColumnType<Date, Date, Date>
  time_updated: ColumnType<Date, Date, Date>
  datum_type: NoteDataType
  datum_tag: string
  datum_status: NoteDataStatus | null
  datum_time_seconds: number | null
}

// Define your database schema interface here
export type Database = {
  notes: DBNote
  note_data: DBNoteData
}
