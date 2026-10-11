import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`update notes n
    set body = jsonb_set(n.body, '{children}', (
      select jsonb_agg(line.body - 'color' order by line.ordinality)
      from jsonb_array_elements(n.body->'children') with ordinality as line(body, ordinality)
    )), revision = revision + 1
    where exists (
      select 1 from jsonb_array_elements(n.body->'children') as line(body)
      where line.body ? 'color'
    )`.execute(db)
}

export async function down(): Promise<void> {
  // Removed colors cannot be recovered. Older clients accept colorless lines.
}

export const tmigration = { up, down }
