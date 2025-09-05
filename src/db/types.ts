import type { ZDoc } from '@/editor/schema'
import type { ColumnType } from 'kysely'

// Custom column type that handles Zod validation
type ZodJsonColumn<T> = ColumnType<T, T, T>

export type DBNote = {
  title: string,
  body: ZodJsonColumn<ZDoc>
  createdAt: ColumnType<Date, Date | undefined, Date>
  updatedAt: ColumnType<Date, Date | undefined, Date>
  revision: number
}

// Define your database schema interface here
export type Database = {
 notes: DBNote;
}
