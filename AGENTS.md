# tekne

Tekne is a freestyle productivity application structured as an outline editor
which allows users to tag chunks of text, record structured data (such as time
spent on a task) and search or navigate through that data easily.

# Testing changes

After making changes

> pnpm types

To ensure there are no type errors and

> pnpm test

if you changed a file with tests that should be tested

If there are any tests present for a specific file, you can run them with

> pnpm run test filename

Once this is done, use the Playwright skill to interact with the running
application. Use browser snapshots to confirm that the page content has changed
in a way that reflects the change being made.

Prefer to use snapshots to observe changes, and only use the screenshot tool to
verify styling changes.

# Running the application

You can run the application with `pnpm run dev:client-only` which will start
the application on port 3000. You can then use 

# Migrations

Database migrations can be created with

> pnpm kysely migrate:make

The resultant file should be filled out, and `src/db/migrations.ts` will need to be updated to account for the new migration.

# GitHub issues

If the user refers to GitHub issues, you can use the `gh` command line app to interact with them.

# File structure

- Files are grouped by feature, for example editor code is in `./src/editor`
- Tests should be placed in the same directory as the file they test, not in a
  separate tests folder. 

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

