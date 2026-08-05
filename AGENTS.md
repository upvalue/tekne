# tekne

Tekne is a freestyle productivity application structured as an outline editor
which allows users to tag chunks of text, record structured data (such as time
spent on a task) and search or navigate through that data easily.

# Running the application

The application is likely already running on localhost:3000, so try that first before testing.

# Migrations

Database migrations can be created with

> pnpm kysely migrate:make

The resultant file should be filled out, and `src/db/migrations.ts` will need to be updated to account for the new migration.

# File structure

- Files are grouped by feature, for example editor code is in `./src/editor`
- Tests should be placed in the same directory as the file they test, not in a
  separate tests folder.

# Package layers

The top-level directories in `src/` are ordered into layers, declared in
`LAYER_ORDER` in `.dependency-cruiser.cjs` and enforced by `pnpm depcruise`
(part of `pnpm check`): a package may only import from packages earlier in
that list (e.g. `db` may import from `docs` but never from `editor`), and
file-level dependency cycles are forbidden. When adding a new top-level
directory, add it to `LAYER_ORDER` at the right position. If an import you want to write would
point upward, the code is probably in the wrong package — move the shared
piece down (see `editor/command-registry.ts` for the pattern: the mechanism
lives low, the definitions register into it from above in `src/commands`).

# CodeMirror Editor

The synchronization between Codemirror (which has its own DOM rendering and management
system) and React is custom:

- lines can update the overall editor state by changing Jotai atoms
- changes to the overall editor state are synchronized to Codemirror by glue
  code which destroys and recreates Codemirror when the line changes externally
- any changes on the individual line content change React state via a codemirror plugin
- Vanilla JS components written in Codemirror may emit CustomEvents, which can
  be listened to higher in the render tree

The editor has a standalone route at `/lab` -- this can be useful for testing the document
editor in isolation from other features from the application.
