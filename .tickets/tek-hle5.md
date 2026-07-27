---
id: tek-hle5
status: closed
deps: []
links: [tek-pn7b]
created: 2026-07-27T04:13:53Z
type: chore
priority: 2
assignee: Phil
tags: [cleanup]
---
# Remove orphaned/dead files (~270 lines)

Files unreachable from any entry point (import-graph verified, zero importers): src/controls/Omnibar.tsx (empty file), src/Icon.tsx (sole consumer of classnames dep), src/panel/GitInfo.tsx (near-dupe of src/documentation/Version.tsx), src/components/IconBadge.tsx, src/components/vendor/CatalystDialog.tsx + src/components/vendor/text.tsx (dead pair; only the radix Dialog is used), src/documentation/DocsNavigation.tsx (superseded by inline nav in src/panel/Help.tsx). Also src/reportWebVitals.ts is CRA scaffolding called with no argument so its dynamic import('web-vitals') is unreachable. NOTE: keep the feature-flag files (src/lib/feature-flags.ts etc.) per discussion 2026-07-27; keep src/documentation/ generated files. Careful: src/documentation/development.tsx and getting-started.tsx are NOT dead, they load via dynamic template-literal import in src/panel/Help.tsx.

## Acceptance Criteria

Listed files deleted; pnpm check (tsc+eslint) passes; app builds and Help panel docs pages still load.


## Notes

**2026-07-27T05:21:16Z**

All 8 files deleted (274 lines), each verified as having zero importers repo-wide before removal. reportWebVitals also needed the import and no-arg call stripped from main.tsx. Kept feature-flag files and the generated src/documentation files per the ticket.

Checked against a running dev server. The Help panel renders Development, Getting Started and Version with no console errors, confirming the template-literal dynamic import in Help.tsx still resolves. pnpm check 0, 216 tests, pnpm build clean.
