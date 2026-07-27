import { PostgresDialect } from 'kysely'
import { defineConfig } from 'kysely-ctl'
import { Pool } from 'pg'

export default defineConfig({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        'postgresql://postgres:password@localhost:5432/tekne',
    }),
  }),
  migrations: {
    migrationFolder: 'src/db/migrations',
  },
})
