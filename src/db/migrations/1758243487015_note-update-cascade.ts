// cascades note_data rows when a note's title changes, so documents that
// carry tagged data can be renamed
import { sql, type Kysely } from 'kysely'

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
	ALTER TABLE note_data
	DROP CONSTRAINT note_data_note_title_fkey,
	ADD CONSTRAINT note_data_note_title_fkey
	FOREIGN KEY (note_title) REFERENCES notes(title)
	ON DELETE CASCADE
	ON UPDATE CASCADE
	`.execute(db)
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
  await sql`
	ALTER TABLE note_data
	DROP CONSTRAINT note_data_note_title_fkey,
	ADD CONSTRAINT note_data_note_title_fkey
	FOREIGN KEY (note_title) REFERENCES notes(title)
	ON DELETE CASCADE
	`.execute(db)
}

export const tmigration = { up, down }
