---
id: tek-bxzt
status: open
deps: []
links: [tek-4huh, tek-e59x]
created: 2026-07-27T04:14:05Z
type: chore
priority: 2
assignee: Phil
tags: [cleanup, deps]
---
# Remove unused dependencies; move dev-only deps to devDependencies

Unused (zero imports across src/, scripts/, hooks/, configs, css): @floating-ui/dom, date-fns, ts-pattern, class-variance-authority, react-hotkeys-hook (pending keybindings-registry decision), classnames (only importer is dead src/Icon.tsx), web-vitals (unreachable dynamic import), @fontsource/iosevka (styles.css only imports @fontsource/inter; 'Iosevka' font-family name never has its @font-face loaded — decide: import it properly or drop it). jotai-trpc becomes removable once trpcJotai export is deleted (see tek-e59x). Misplaced in dependencies, should be devDependencies: kysely-codegen, concurrently, @tanstack/router-plugin, @tanstack/react-router-devtools, @types/pg, @electric-sql/pglite-repl, tailwindcss, @tailwindcss/vite.

## Acceptance Criteria

pnpm install clean; pnpm build and pnpm test pass; no runtime import errors in dev and prod modes.

