---
id: tek-e59x
status: closed
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

## Notes

**2026-07-27T05:43:56Z**

dist is 16M -> 2.6M, and the big client chunk went 1.67MB -> 646KB.

The dynamic import the ticket describes was necessary but didn't get there on
its own.

Top-level await isn't available at the configured build target (es2020), so the
in-memory branch can't just await an import. There's a lazyLink instead that
stands in for the real link and loads it on the first operation.
createTRPCClient initialises links when the client is constructed, which is too
early to await anything.

Rollup does drop the dead branch, but only after loading the modules, and by
then Vite has already emitted pglite's wasm and data into dist/assets as orphans
nothing ever fetches. So there's also a small vite plugin stubbing the dev-only
modules at load time in production mode. First attempt did it in resolveId and
never fired -- vite's core resolver runs before normal user plugins. Matching
resolved paths in load with enforce: 'pre' works.

Second pglite entry point the audit missed: src/dev/PgliteDevtools.tsx is
statically imported by DevTools, which Panel renders in the Dev tab in
production too. Runtime-gated on `!!window.dbHandle` so it never rendered, but
the static import was enough to pull in pglite and the repl.

trpcJotai deleted, no consumers.

Checked it in the browser on dev:client-only. Migrations run, created
2026-07-27, typed a tagged line, reloaded, the content persisted and the tag
came back in the aggregate panel.

Didn't fix: on a fresh IndexedDB, dbMemory sets window.db before migrateToLatest
resolves, so concurrent callers get the handle early and the first three queries
fail with `relation "notes" does not exist`. Same three errors on the unmodified
code, so it's pre-existing. Probably worth its own ticket.

