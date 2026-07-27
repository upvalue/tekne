---
id: tek-r9lr
status: closed
deps: []
links: []
created: 2026-07-27T04:14:21Z
type: chore
priority: 2
assignee: Phil
tags: [ci, cleanup]
---
# Fix and enforce pnpm check (format + lint) 

pnpm check (tsc + eslint + prettier --check) is currently red: 50 files fail prettier (codebase has drifted into two styles — e.g. src/panel/DocumentOverview.tsx and src/editor/StatusBar.tsx are 4-space+semicolons vs .prettierrc 2-space/no-semi) and 2 eslint errors (no-regex-spaces in src/docs/tag-rename.test.ts:138, no-useless-escape in generated-but-committed src/server/client-routes.ts:72), plus ~15 unused-var warnings. Nothing enforces it.

## Design

1) Run pnpm format + eslint --fix as a standalone commit so it doesn't pollute future diffs. 2) Fix the 2 real eslint errors (for client-routes.ts fix the generator script, not the output). 3) Add enforcement: run pnpm check in CI (.github/workflows) so it can't drift again.

## Acceptance Criteria

pnpm check exits 0; CI fails on formatting/lint regressions.


## Notes

**2026-07-27T05:16:47Z**

Done in 3 commits: (1) 9203558 fixed the generator behind the no-useless-escape error -- the template literal ate the backslash in \$, so the emitted matcher was /$\w+/g and could never match; also aligned the template with .prettierrc so a build can't regenerate a check-failing file. (2) 4820f57 mechanical pnpm format over 62 files, plus a new .prettierignore (build output, docs-build, the 4 generated src/documentation files, .tickets, .agents) -- prettier was scanning 94 files, a third of which it should never touch. (3) d80abab new Check workflow on PR + push, and deploy.yml's pnpm types upgraded to pnpm check.

The second error the ticket mentioned (no-regex-spaces in tag-rename.test.ts:138) was already gone. Left the 13 unused-var/exhaustive-deps warnings alone: eslint exits 0 on warnings, and several sit in files that tek-dsps and tek-hle5 will touch.
