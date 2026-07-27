---
id: tek-dsps
status: closed
deps: []
links: []
created: 2026-07-27T04:14:22Z
type: chore
priority: 2
assignee: Phil
tags: [cleanup, perf]
---
# Strip leftover console.log debugging (hot typing path included)

Debug logs left in shipping code. Hot-path (fire per keystroke or per editor event — measurable perf drag): src/lib/eventemitter.ts:47, src/editor/line-editor.ts:122,232,259,265,353, src/editor/line-editor/line-operations.ts:153,200,246, src/docs/doc-analysis.ts:153. One-off noise: src/editor/TitleBar.tsx:48 ('woodle doodle doo'), src/editor/StatusBar.tsx:160-161, src/trpc/routers/doc.ts:124, src/editor/TEditor.tsx:172. Keep intentional init/server logging (src/server/index.ts, src/db/migrations.ts, src/trpc/client.ts init lines). Consider an eslint no-console rule (with allowlist) to prevent recurrence.

## Acceptance Criteria

No stray console.log in editor hot paths or components; typing in /lab produces zero console output; intentional server/init logs retained.


## Notes

**2026-07-27T05:18:55Z**

All 13 listed sites removed. TEditor.tsx:172 was already clean (stale line ref). Added no-console (allow warn/error) over src/ with server/db/dev/trpc exempt, so this can't recur silently now that CI runs pnpm check.

Deliberately kept: doc.ts link-rewrite logging in the rename path (server-side, once per link, not a hot path) and doc.ts:191 '$Daily template not found'. Both are outside the acceptance criteria's 'editor hot paths or components'.

Verified against a real dev server on /lab with playwright: clicked into the editor, typed, pressed Enter, typed again -- zero console entries from src/editor, src/lib or src/docs. Only migration and tRPC-init banners remain on load.

**2026-07-27T05:21:16Z**

Follow-up eaa7732: dropped the no-console rule. Too aggressive -- it makes a routine debugging step fail CI. The log removals themselves stand.
