---
id: tek-lkzs
status: closed
deps: []
links: []
created: 2026-07-27T04:14:06Z
type: chore
priority: 3
assignee: Phil
tags: [cleanup, git]
---
# Untrack .vite/deps build artifacts

.vite/deps/_metadata.json and .vite/deps/package.json are Vite dep-optimizer cache artifacts, accidentally committed in de85334 (relocate to top level directory). They churn on dependency changes and don't belong in git.

## Acceptance Criteria

git rm --cached .vite; .vite/ added to .gitignore; no .vite files tracked.

