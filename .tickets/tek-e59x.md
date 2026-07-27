---
id: tek-e59x
status: open
deps: []
links: [tek-4huh, tek-bxzt]
created: 2026-07-27T04:13:39Z
type: bug
priority: 1
assignee: Phil
tags: [build, perf, cleanup]
---
# Stop shipping server router + PGlite in the production client bundle

src/trpc/client.ts statically imports appRouter (src/trpc/router.ts) and dbHandle (src/db) at module top level. The local in-memory link (unstable_localLink) is only ever used in dev, but because the imports are static, every production build ships: all five tRPC routers (~1700 lines of Kysely SQL), db migrations, @electric-sql/pglite (8.8MB wasm + 4.9MB data in dist/assets), and node builtins (fs/child_process/path via src/trpc/router.ts). Verified: pglite wasm/data and SQL strings (selectFrom, note_data, add-feature-flags) are present in dist/assets.

## Design

Gate the local-link branch behind a dynamic await import() so the router/PGlite chunk is only fetched when trpcUrl is unset (dev in-memory mode). Also remove the trpcJotai export (client.ts:46-59) which has zero consumers and duplicates the links config verbatim (tracked separately for the jotai-trpc dep removal).

## Acceptance Criteria

Production build (pnpm build) contains no pglite wasm/data assets and no server SQL strings in client chunks; dev in-memory mode (dev:client-only) still works.

