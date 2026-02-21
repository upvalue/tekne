---
id: tek-qg7g
status: open
deps: []
links: []
created: 2026-02-21T03:44:00Z
type: feature
priority: 2
assignee: Phil
tags: [undo, editor, feature-flags]
---
# Document-level undo/redo with feature flags

Implemented a document-level undo/redo system for the outline editor, gated behind a feature flag. Previously, only CodeMirror's per-line browser-native undo existed — structural operations (adding/deleting/merging lines, indenting, metadata changes) were irreversible.

## Design

Snapshot-based undo: a derived docAtom wrapper captures full document state before every write, pushing to an undo stack (max 1000 entries). Redo stack is cleared on new edits. CodeMirror integration uses in-place dispatch with an Annotation guard to prevent echo writes. Keybindings use EditorView.domEventHandlers (not CM keymap) to correctly distinguish Ctrl+Z from Ctrl+Shift+Z on Linux. Feature flags backed by a database table with a TRPC router, toggled from the Dev panel's Flags tab.

## Acceptance Criteria

- Cmd/Ctrl+Z undoes all document operations (typing, line add/delete/merge, indent/outdent, metadata)
- Cmd/Ctrl+Shift+Z redoes
- Undo history resets on document navigation
- Feature flag toggle in Dev panel > Flags tab
- With flag off, browser-native per-line undo still works
- Types pass (pnpm types), all tests pass (pnpm test)
- Known limitation: timer data (datumTimeSeconds) lives in docAtom and can be undone — future work to separate timer data from document model


## Notes

**2026-02-21T03:44:16Z**

Files created:
- src/db/migrations/1771632000000_add-feature-flags.ts (feature_flags table)
- src/trpc/routers/flags.ts (getAll query, set mutation with upsert)
- src/lib/feature-flags.ts (featureFlagsAtom, documentUndoEnabledAtom, useFeatureFlag hook)
- src/dev/FeatureFlags.tsx (toggle UI component, used in Dev panel and /dev route)
- src/editor/undo.ts (undo/redo stacks, suppress guard, undo/redo/reset functions)
- src/routes/dev.tsx (standalone dev settings page)

Files modified:
- src/db/types.ts (DBFeatureFlag type, Database interface)
- src/db/migrations.ts (registered new migration)
- src/trpc/router.ts (added flags router)
- src/editor/state.ts (renamed docAtom to rawDocAtom, new docAtom with undo capture)
- src/editor/line-editor.ts (in-place CM sync via Annotation, echo prevention)
- src/editor/line-editor/line-operations.ts (domEventHandlers for Mod-z/Mod-Shift-z)
- src/routes/n/$title.tsx (resetUndoHistory on doc load, flag sync to editor store)
- src/routes/__root.tsx (flag initialization)
- src/dev/DevTools.tsx (added Flags tab)

**2026-02-21T03:44:28Z**

Key bugs found and fixed during implementation:
- require() in ESM/Vite: rewrote to standard ESM imports (circular imports work at runtime for atoms)
- CM Mod-z matches both Ctrl+Z and Ctrl+Shift+Z on Linux: switched to EditorView.domEventHandlers with direct event inspection
- Editor isolated Jotai store: __root.tsx set flag in default store, editor uses createStore() — added flag sync in $title.tsx
- domEventHandlers unconditionally blocking Cmd+Z when flag off: added feature flag check before preventDefault

Future work:
- Separate timer data from document model (timer entries table) to avoid undo affecting recorded time
- Cursor restoration within lines (currently restores to end of line content)
- Consider key={line.timeCreated} instead of index-based React keys for TEditor
