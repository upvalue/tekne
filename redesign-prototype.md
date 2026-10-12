# Tekne redesign prototype — implementation brief

## Prompt

You are implementing a prototype of a full visual and interaction redesign of
Tekne, an outline editor (React + TypeScript, Tailwind v4, CodeMirror 6, Base
UI, TanStack Router/Query). The design was worked out in mockups with the
user. This file is the spec. Read `CLAUDE.md`/`AGENTS.md` and
`AGENTS.local.md` first, then the files under "Where things are in the code".

Work on a new branch (`redesign-prototype`) off `master`. This is a prototype:
aim for a working app that looks and behaves like the spec, end to end, rather
than polish on one corner. Don't change the database schema or the stored
document format. Keep `pnpm check` and `pnpm test` passing, and update tests
that assert on markup you change. Commit in reviewable steps (theme tokens
first, then layout, then each feature).

Where the spec is silent, follow the constraints below and pick the plainer
option. Where something is marked **provisional**, build it as written; the user
will judge it in the running app. Write down anything you had to guess in
`wiki/redesign-prototype-notes.md`.

The mockups are in `redesign-mockups/`. Each one is a single self-contained HTML
file that works offline. Open it in a browser, or load it with Playwright via
`page.setContent()`, since some setups block `file:` URLs.

- `redesign-mockups/editor.html`: the editor screen, interactive. You can
  click bullets, checkboxes, time chips and the hover "▶ Stopwatch" button,
  type slash commands in the new-line field, open ⌘K from the title row, and
  switch the panel between page and search views. The bar at the bottom left
  switches between the candidate themes and panel looks; it is only part of
  the mockup and not something to build.
- `redesign-mockups/timers.html`: a static page describing how timers work.
  It still uses an older amber accent. Follow this brief's colours, not that
  page's.

Treat the mockups as the visual reference for spacing, sizes and states. The
JavaScript in them is mockup code and shouldn't be copied. The mockups use
system-ui; the app keeps Inter. Where the mockups and this brief disagree,
follow this brief.

## Constraints from the user

These are firm.

- **Dark mode only.** No light theme.
- **Web only.** No native-looking title bar. The browser tab title is fair game.
- **One document per page.** No tabs, no permanent navigation sidebar.
- **Aggregate data and search are core.** The side panel carries them.
- **No line colours** (already removed from the data model).
- **Fewer borders.** Separate things with spacing and slight background
  shifts, not lines.
- **One accent colour, used sparingly.** Meaning colours only where they carry
  meaning (green for "+1 done" in tag summaries, not on checkboxes).
- **No made-up colours.** Every colour comes from the palette below. Don't
  introduce Tailwind's stock zinc/sky/etc. values. Hover and secondary fills
  may be translucent white (e.g. `rgba(255,255,255,0.03–0.09)`).
- **Keep stopwatch, countdown and manual time entry.** Drop the timer dialog
  and mode tabs.
- **Keep the muted timestamp gutter** on the left.
- **Date documents are titled ISO-style** (`2026-10-11`). Date navigation
  (‹ › Today) only appears on date documents.

## Theme: Harmony Neutral · Blue

Source: Evil Martians Harmony v1.4.0 (github.com/evilmartians/harmony), the
OKLCH palette with sRGB hex fallbacks. It is a Tailwind v4 drop-in, so you may
install it and use its variables instead of the hex values. Either way, use
exactly these steps.

| Role | Harmony step | Hex |
|---|---|---|
| Page background (also the panel) | neutral-950 | `#141414` |
| Raised surfaces (popovers, palette, timer row, inputs) | neutral-900 | `#2e2e2e` |
| Faint marks (bullets, gutter rules if any) | neutral-800 | `#4b4b4b` |
| Text, main | neutral-200 | `#e4e4e4` |
| Text, secondary | neutral-400 | `#bababa` |
| Text, muted (gutter timestamps, hints) | neutral-600 | `#838383` |
| Accent text (tags, running timer, focus) | blue-400 | `#6fc2fa` |
| Accent fill (primary buttons) | blue-600 | `#0c8aca` |
| Text on accent fill | blue-950 | `#011523` |
| Accent tint (selected row, running chip background) | blue-900 | `#03314a` |
| Done (tag summaries only) | emerald-400 | `#8fc982` |

Put these in CSS variables in `src/styles/styles.css` (`@theme`) with role
names (`--color-page`, `--color-raised`, `--color-text-2`, `--color-accent`,
…) and replace the hard-coded zinc/sky usage across the app. Keep the theme
in one place so the user can try the other Harmony pairs later. The other
candidates still being considered are Neutral · Sky, Neutral · Indigo,
Sand · Blue, Sand · Indigo, Stone · Amber and Mauve · Orange, all using the same
step-to-role rule. A dev-only theme switcher (e.g. in `src/dev/`) is welcome
but optional.

Font: keep Inter (already bundled). Monospace for times and durations.

## Layout

- **No top bar.** The document's title row is the header:
  - left: the title (`2026-10-11` or the document name), then on date
    documents ‹ › and "Today";
  - right: the running-timer pill (only while a timer runs; click to jump to
    its line), a ⌘K button, and the panel toggle.
  - Under the title, one muted line: weekday on date documents, plus counts
    (e.g. lines, open tasks, time logged).
- **Gutter:** 96px column on the left with muted timestamps.
- **Outline lines:** about 30px minimum row height, 22px line height, 15px text.
  Headings are plain bold text (18px, weight ~650) with extra space above.
- **Bullets carry state:**
  - plain dot;
  - pinned: a pin glyph;
  - collapsed: dot with a soft halo plus a muted "+N" count of hidden children;
  - task lines: a checkbox replaces the bullet (no colour on checked);
  - cancelled task: a dash in the box and strikethrough text.
- **Links** are plain text with an underline. **Tags** use the accent colour.
- **Empty days** open as a blank page the user can type into, not an empty
  state message.
- **Toasts** report results, with Undo where an action can be undone.

## Slash commands

At the end of the document there is always a field for a new line. Typing `/`
in any line offers commands, with a preview of what the line will become:

- `/stopwatch`: start a stopwatch on this line
- `/countdown 25m`: start a countdown
- `/log 45m`: add 45m to the line
- `/task`: turn the line into a task
- `/pin`: pin the line
- `/date`: insert a date

Use CodeMirror autocomplete (`@codemirror/autocomplete` is already a
dependency).

## Command palette (⌘K)

One flat list, grouped in this order: **This line** (commands for the line
the cursor is on), **Go to**, **Panel**, **Tools** (bulk cleanup, tag rename
stay here), **Help**. No background blur or dimming behind it. Raised
background, no border. There is currently both `src/controls/KBar.tsx` and
`src/editor/CommandPalette.tsx`; end up with one palette.

## Timers

Current behaviour (keep it): one global timer; modes stopwatch, countdown and
manual; a countdown completes itself at zero (sound, notification, logs the
target length). Read `src/editor/timer/timer-controller.ts` before changing
anything.

New interaction:

- **On the line:** the line's time shows as a small monospace chip at the end
  of the line.
  - Nothing running, time logged: muted clock icon + `56m`. Click opens the
    timer row.
  - Stopwatch running: accent text on accent tint, with a dot: `● 56:04`
    (the line's total so far).
  - Countdown running: `● 18:22 left`.
  - Paused: pause icon + time, muted on a faint translucent fill.
- **Hover a line with no time:** a split button at the end of the line,
  "▶ Stopwatch | ▾". The left part starts a stopwatch; ▾ opens the timer row.
- **Timer row (opens under the line, not a dialog):** a raised panel with the
  line's logged time on top, then three side-by-side choices, no tabs:
  - **Stopwatch:** Start (accent fill).
  - **Countdown:** 15m / 25m / 50m buttons, plus a field to type a length. One
    click starts.
  - **Enter time:** an input (`45m`, `1h 20m`), then **Add** or **Set total**.
- **While running (the same row):** mode label ("Countdown · 25m"), big
  monospace time, a muted line ("Ends at 3:25 PM · 44m logged before"), then
  buttons: `+5m` (countdowns only), Pause, **Stop · add 6:38** (accent fill),
  **Stop · replace 44m** (only when the line already had time), Discard.
  Countdowns get a 3px progress bar along the bottom edge.
- **Add vs replace is chosen when stopping.** This replaces the up-front
  `timeMode` switch in the UI. The existing additive/replacement logic should
  still do the work underneath; the stop button just picks which.
- **Shortcuts:** ⌥T starts or pauses a stopwatch on the current line; ⌥⇧T
  opens the timer row.
- **Running time is also shown** in the title row pill (top right) and in the
  browser tab title, e.g. `● 18:22 · Write tutorial copy`.
- Running state uses the theme accent, no separate green.
- **Second timer (provisional):** keep the current behaviour (starting a
  second timer is refused, with a toast that names the running line and
  offers to jump there). The editor mockup shows a "Switch here" button for
  this case instead. The user hasn't confirmed that, so don't build it.
- The status bar timer controls and `TimerInfo`/dialog-style UI go away.

## Side panel

Toggled from the title row. **Same background as the page.**

- **Separation (provisional):** spacing only: no border, no background change,
  a wide gap between the document column and the panel. Keep the separation
  in one place in the CSS, because the user may switch to one of:
  - a hairline (1px, `rgba(255,255,255,0.06)`);
  - a floating sheet (slightly lighter, rounded, inset from the edges);
  - a margin column (no tabs; search box on top, page summary under it until
    you type).
- **Page view:**
  - **Outline:** the document's headings, click to jump.
  - **Tags on this page:** one entry per tag, showing this page's numbers on
    the right (`+32m`, `+1 done` in the done colour, `2 open`), all-time totals
    below in muted text, and the tag's pinned line if it has one. No charts or
    bars.
- **Search:** query box with operator suggestions as you type, saved searches
  under it, results grouped by document.

Existing pieces to rework rather than rewrite where possible:
`src/panel/Aggregate*.tsx`, `DocumentOverview.tsx`, `Search.tsx`,
`SavedSearches.tsx`, `tags/`, `tasks/`, `timers/`.

## Out of scope for this prototype

- Hiding markdown syntax except on the line being edited (idea only).
- A font switcher.
- Mobile/touch layout changes beyond not breaking what's there.
- The agent panel (`src/panel/agent`): restyle it with the new colours, but
  don't redesign it.

## Where things are in the code

- Styles: `src/styles/styles.css`, `src/styles/system.css`,
  `src/editor/TEditor.css`.
- Layout: `src/layout/EditorLayout.tsx`, `EditorShell.tsx`.
- Title, status bar: `src/editor/TitleBar.tsx`, `StatusBar.tsx`,
  `DocumentDetails.tsx`; tab title in `src/lib/title.ts`, `src/hooks/useDocTitle.ts`.
- Lines and bullets: `src/editor/ELine.tsx`, `LineGlyph.tsx`,
  `line-visuals.ts`, `ReadOnlyLine.tsx`; gutter in `src/docs/gutters.ts`.
- Timers: `src/editor/timer/`, `TimerBadge.tsx`, `TimerInfo.tsx`,
  `src/panel/timers/`.
- Palette and commands: `src/controls/KBar.tsx`, `src/editor/CommandPalette.tsx`,
  `src/editor/command-registry.ts`, `src/commands/`.
- Panel: `src/panel/Panel.tsx` and siblings; panel state in
  `src/hooks/panel-state.ts`.
- Date routes: `src/routes/n/`.

## Checking your work

The dev server is usually already running on `localhost:3000` (see
`AGENTS.local.md`). Look at the real app in a browser as you go: a date
document with tasks, tags, collapsed and pinned lines, a running stopwatch, a
running countdown, the palette open, and the panel in page and search views.
Don't deploy to production.
