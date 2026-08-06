# Mobile roadmap: responsive fixes, then touch controls around the editor

Status: phases 1-5 are implemented (branch `worktree-mobile-touch-mode`).
Phase 6 is the remaining pick-list. This doc records the design and what
shipped; deltas from the original plan are marked inline.

The idea: not a separate mobile editor -- the existing outline editor stays,
one CodeMirror instance per line and all. What changes on small/touch screens
is the control surface around it: tap a line to select it, step up and down,
insert a line before or after, indent, move, toggle -- all as buttons instead
of keystrokes. Editing happens in the line's own CodeMirror, entered
deliberately, so the keyboard only appears when you ask for it. Voice input
comes free from the mobile keyboard's dictation. Agentic-editor integration
was out of scope for this work; the document-edit agent panel has since
landed separately, and wiring it into touch mode is future work.

## Decisions (as implemented)

**Mode selection is adaptive, same route.** Touch mode turns on when the
viewport is under 768px or the pointer is coarse, overridable per device.
`src/hooks/display-mode.ts`: pure `resolveDisplayMode(override, isNarrow,
isCoarse)`, `useMediaQuery` from usehooks-ts, override in
`atomWithStorage('tekne.displayMode')` on `uiStore`. localStorage, not the
flags router -- a mode override is a per-device preference. The resolved mode
is mirrored into `displayModeAtom` so non-React code (the focus gate, palette
commands) can read it; `EditorShell` runs `useSyncDisplayMode()` once. A
`display-mode` palette command sets auto/desktop/touch; the TouchBar sheet
has a desktop switch and desktop mode on a touch device gets a floating
button back.

**Select and edit are distinct states on touch.** Tapping a line hits a
transparent overlay button (`.ELine-touch-overlay` in ELine), which selects
without focusing CodeMirror -- the keyboard stays down. Selection is
`touchSelectedLineIdAtom` (route store, keyed by `timeCreated` so it survives
moves). Delta from the plan: no editable-compartment work was needed at all;
the overlay alone keeps taps away from CodeMirror, and programmatic focus is
controlled by the gate below.

**A focus-request gate, not per-line editable flags.** Everything that used
to move CodeMirror focus (delete, undo, drag-end) goes through
`requestFocusLineAtom`. In touch mode with no editing session active, the
consumer in `line-editor.ts` downgrades a focus request to a selection
update. When `touchEditingLineIdAtom` is set, requests pass through and the
session follows them -- so Enter-splits and backspace-joins keep the keyboard
flowing across lines exactly like desktop, which is also the rapid-capture
dictation flow.

**Edit mode is deliberate.** Second tap on the selected line, or the pencil
button. Done (or tapping another line) clears the session and blurs. While
editing the bar shrinks to undo/redo/Done and rides above the software
keyboard via a `visualViewport` inset.

## What shipped, by phase

**Phase 1 -- responsive foundation.** `panelVisibleAtom` is now derived from
a user-choice atom plus a live `matchMedia`-fed `isWideViewportAtom` (the old
default was computed once at import). `vh` became `dvh` (Panel, TEditor,
index.html). The 178px gutter hides below 768px; the 138px/162px paddings
gained `md:` variants; the `@source inline` hack in styles.css is gone
(NonEditorLayout uses a literal class now). `platform.ts` distinguishes
`isMac` / `isIOS` / `isApple` / `isTouchPrimary` -- key matching uses
`isApple`, so iPhones stop being "Macs". Drag handles are visible under
`(pointer: coarse)`. The vitest browser project pins a 1280px viewport since
the default 414px is below the breakpoint where the gutter hides.

**Phase 2 -- line ops.** `src/editor/line-ops.ts`: every mutation as
`(store, lineIdx, ...)` with no `@codemirror` imports -- indent/outdent,
insert above/below (below skips a collapsed subtree), delete (with a
`requestFocus: false` option), collapse, pin, task toggle + status cycle,
color, timer add/remove and dialog request, and sibling-block moves built on
`moveSelectedLines`, plus `canMoveBlockUp/Down` predicates. Keymap, event
handlers and the ELine checkbox are adapters. Delta from the plan: most of
the extraction had already happened upstream (`line-mutations.ts` existed,
and the datum handlers were already document-level in
`useDocumentLineEvents`), so this phase was smaller than expected and Enter
didn't need touching.

**Phase 3 -- selection without a keyboard.** Display-mode hook, tap overlay,
emerald selected highlight, and the bottom `TouchBar`
(`src/editor/touch/TouchBar.tsx`) with steppers over
`getVisibleLineIds`-based navigation (`touch-nav.ts`), collapse, and the
mode switch. TEditor passes touch props into ELine; EditorShell renders the
bar.

**Phase 4 -- the full action set.** Bar: outdent/indent (predicate-disabled),
pencil, insert below, More. Sheet: insert above, move block up/down,
collapse, checkbox, pin, timer add/remove + stopwatch start/stop via
`timer-controller`, color swatches, delete with confirm, undo/redo, desktop
switch. Delete keeps selection on the nearest visible neighbor. Delta: move
up/down live in the sheet, not the bar -- nine bar buttons overflow a 360px
screen.

**Phase 5 -- edit mode.** As described in the decisions above.

All of it was exercised in an emulated mobile viewport (Playwright,
client-only PGlite mode): select/step/collapse skipping hidden lines, block
moves carrying collapsed subtrees, sheet toggles, delete + undo without the
keyboard appearing, and the type/Enter/type capture flow.

## Known issues

- Fast automated typing right after a focus change drops leading keystrokes
  ("first" landed as "f"). Pre-existing sync race in the per-line CodeMirror
  integration, visible at Playwright speed on desktop mode too; not
  addressed here. Worth watching for under real dictation, which commits
  text in bursts.
- `getColorClass` in ELine produces a dangling `editor-line-undefined` class
  on uncolored lines. Cosmetic, pre-existing.

## Phase 6 -- remaining pick-list

- Real-device pass (iOS Safari, Android Chrome) over the phase 3-5 flows:
  keyboard appearance timing, `visualViewport` inset behavior, safe-area
  padding, dictation.
- Profile a 500+ line doc on a phone; if per-line CodeMirror is too heavy,
  render non-selected lines as parser-derived spans (`TEKNE_MD_PARSER` +
  `visitMdTree`) and mount the real view lazily on selection -- an ELine
  internal change, not a new editor.
- Timer dialog parity (countdown/manual) by extracting the dialog from
  `TimerBadge`.
- dnd-kit `TouchSensor` so long-press drag works as an alternative to the
  move buttons, especially on tablets.
- Tag autocomplete ergonomics in edit mode on touch (the completion popup
  was designed for a pointer; check it's usable above the keyboard).
- Decide whether touch mode gets a search sheet; `openPanelTab` currently
  assumes the desktop `EditorLayout`.
- Surface the agent panel in touch mode -- it pairs well with dictation
  (speak an instruction, let the agent edit).
