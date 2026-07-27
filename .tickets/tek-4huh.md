---
id: tek-4huh
status: open
deps: []
links: [tek-bxzt, tek-e59x]
created: 2026-07-27T04:19:31Z
type: task
priority: 2
assignee: Phil
tags: [cleanup, frontend, keybindings]
---
# Unify keybindings: make src/lib/keys.ts registry drive real bindings

src/lib/keys.ts is a keybindings registry whose entries are tagged type: 'react' (meant for react-hotkeys-hook) or 'codemirror', but react-hotkeys-hook is imported nowhere — the registry is display-only (Help panel). Actual bindings are four independent window.addEventListener('keydown') blocks with three different modifier-detection styles: __root.tsx:20-35 (Cmd+/ and Cmd+\, metaKey||ctrlKey), CommandPaletteProvider.tsx:16-27 (Cmd+K, isMac-aware), StatusBar.tsx:105-115 (Ctrl+G, ctrlKey only), CommandPalette.tsx (capture-phase internals). Help display and real bindings can silently drift; Cmd+\ is not in the registry at all; getKeybinding has zero callers. NOTE: explore BOTH options before committing — there is probably a forgotten historical reason for the current shape (Phil, 2026-07-27); check git log/blame on keys.ts and the four handlers for context before picking.

## Design

Option A: registry becomes the runtime — add useGlobalKeybinding(id, handler) (~30 lines) that resolves the combo from keys.ts with normalized modifier matching (meta = metaKey on Mac / ctrlKey elsewhere); replace the four ad-hoc listeners; register the missing meta+\ entry; drop react-hotkeys-hook. Option B: adopt react-hotkeys-hook as originally intended — components call useHotkeys(getKeybinding(id).key, handler); less code but adds a dep and obscures the palette's capture-phase/focus-filtering needs. Either way: CodeMirror-scoped bindings stay in CM keymaps but keep registry entries for display; Help panel keeps reading the registry so display cannot drift from behavior.

## Acceptance Criteria

All global bindings resolved from the registry (single modifier-normalization path); Help panel display provably matches behavior; meta+\ registered; unused code (getKeybinding or the hook dep, depending on option) removed; rationale for chosen option recorded in ticket notes after investigating history.


## Notes

**2026-07-27T05:47:40Z**

tek-bxzt removed the other unused deps but left react-hotkeys-hook installed --
option B adopts it, so pulling it now and re-adding it later is churn. Removing
it is part of this ticket if option A wins.
