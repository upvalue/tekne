---
id: tek-bxzt
status: closed
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

## Notes

**2026-07-27T05:47:40Z**

Dropped 8: @floating-ui/dom, @fontsource/iosevka, class-variance-authority,
classnames, date-fns, jotai-trpc, ts-pattern, web-vitals. Moved 8 to
devDependencies: @electric-sql/pglite-repl, @tailwindcss/vite,
@tanstack/react-router-devtools, @tanstack/router-plugin, @types/pg,
concurrently, kysely-codegen, tailwindcss. Sorted both blocks while in there.

Iosevka: dropped the package and left the name in the font stacks
(styles.css:13, system.css:11). It's already what the stack means today, since
@fontsource/iosevka was never imported and no @font-face for it ever loaded --
you get Iosevka if it's installed locally, otherwise the next entry, same as
Menlo and Monaco below it. Importing it would have changed rendering; dropping
it changes nothing.

@tanstack/react-router-devtools is imported by DevTools.tsx, which the Panel
renders in production, so it looked like a real dependency. It isn't -- the
package compiles to nothing in a production build. Checked the Dev tab against
the built bundle: renders, no pglite tab, zero console errors, and no
router-devtools code in dist/assets.

react-hotkeys-hook stays for now. It's unused today, but tek-4huh's option B
adopts it, so removing it before that's settled is churn either way. Folded it
into tek-4huh instead.

pnpm install clean (-10 packages), build clean, 216 tests pass. Checked both
modes in the browser for import errors: dev:client-only picks the in-memory
link, vite preview over dist picks /api/trpc. Neither logs a module error.

