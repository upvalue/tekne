# Tekne redesign — session handoff (updated 2026-10-12)

Context for picking up the design conversation about how Tekne looks and
behaves. This replaces the earlier handoff; rounds 1–3 are summarised below.

## Goal

Make Tekne (demo: https://demo.tekne.app/) feel like a designed product rather
than a stock Tailwind web app. Influences: Zed, and iOS/macOS writing and task
apps (Things, Typora, iA Writer) as *visual* inspiration only. Interactions are
in scope too: timers, slash commands, the side panel, the command palette.

## Constraints and preferences (stated by the user)

- **Dark mode only.** Never propose a light theme.
- **Web is the platform.** No native title bar or OS surfaces; the browser tab
  title is fair game.
- **One document per page.** No tabs, no permanent navigation sidebar.
- **Aggregate data and search are core**; the side panel carries them.
- **Line colours are deprecated**; leave them out.
- Keep the **muted timestamp gutter** (dates/times in the left margin).
- Outline editor: bullets carry state (collapsed, pinned); checkboxes replace
  bullets on task lines.
- **Date documents are titled `2026-10-11`** (ISO), not "Saturday 11 October".
  Non-date documents exist too; date navigation (‹ ›) only on date documents.
- **Fewer borders.** Separate things with spacing and slight background shifts.
- **Colour:** one accent, used with restraint. Meaning colours are fine where
  they carry meaning, e.g. green for "+1 done" in the tag summaries only (not
  on checkboxes).
- **No invented ("LLM-slopped") colours.** Palettes must come from a real,
  citable source with exact values. No corporate design systems either
  (Atlassian and Adobe Spectrum were rejected outright as "corpo").
- **Timers: keep stopwatch, countdown and manual entry.** They are all useful.
  Simplify how you choose between them; drop the modal.
- Mockups are Claude artifacts (Design canvas, HTML). Don't change the user's
  system to work around tool problems.
- Speak plainly, no invented jargon.

## The artifacts

- **Current canvas (start here):** https://claude.ai/artifact/HRoo3mxiiERai2HaKPGLBx
  - `project/Main.dc.html`: the editor screen, interactive. Bottom-left
    switcher picks the **theme** and the **side panel style**.
  - `project/Timers.dc.html`: static spec of how timers work. Its colours are
    still the old Quiet amber; it doesn't follow the theme switcher.
- Old canvas with rounds 1–3 (history only): https://claude.ai/artifact/HiPeusNtdUR8qDZfE2Svme

Editing notes for the Design canvas:
- Read the canvas (Artifact `read` on the URL, then `path` for files) before
  publishing, or the publish is refused. Publish with `url`, `root` (folder
  holding `project/`) and `file_path`/`files`.
- `{{ }}` holes are lookups only, no expressions. Theme colours are passed as
  `{{ c.<token> }}` holes because CSS variables in inline styles aren't
  reliable; hover and secondary fills are translucent white so they work on
  every theme.
- A quick syntax check of the board's script catches most breakage: extract the
  `data-dc-script` block, prepend `class DCLogic{};`, run `node --check`.

## Current design (Main.dc.html)

- **No top bar.** The title row is the header: title, ‹ › and "Today" on date
  documents, then at the right end the running-timer pill, ⌘K and the panel
  toggle. Weekday and counts sit in a grey line under the title.
- Gutter timestamps at left (96px column), outline lines with bullet states:
  dot, pin, collapsed (halo + "+N"), checkbox for tasks (cancelled = dash +
  strikethrough).
- Links are plain text with an underline; tags use the accent.
- New-line field at the bottom with slash commands and a preview line
  (`/stopwatch`, `/countdown 25m`, `/log 45m`, `/task`, `/pin`, `/date`).
- Empty days open as a blank page you can type into.
- Command palette (⌘K): one list, "This line" commands first, then Go to,
  Panel, Tools, Help, Mockup theme. No blur or dimming.
- Toasts for results, with Undo where it makes sense.

### Timers (also in Timers.dc.html)

From the code: one global timer; modes stopwatch / countdown / manual;
`timeMode` additive vs replacement applies to all of them (default
replacement); a countdown completes itself at zero (sound + notification +
logs the target length); starting a timer while one is active is refused.

Proposal:
- Clicking a line's time (or the ▾ on the hover button) opens a row **under
  the line** with three side-by-side choices, no tabs:
  **Stopwatch** (Start) · **Countdown** (15m / 25m / 50m / type a length:
  one click starts) · **Enter time** (input, then **Add** or **Set total**).
- Hovering a line with no time shows a split button: "▶ Stopwatch" | ▾.
- ⌥T starts/pauses a stopwatch on the current line; ⌥⇧T opens the row.
- While running: mode label, big time, Pause, **Stop · add 6:38**, and
  **Stop · replace 44m** (only when the line already has time), Discard.
  Countdowns show "+5m" and a thin progress bar.
- Add vs replace is chosen at stop time, replacing the up-front switch.
- Running state uses the theme accent (no separate green). Running time also
  shows top right of the title row and in the browser tab title.
- Proposed change: "Switch here" stops and logs the running timer and starts
  the new one, with Undo, instead of refusing. **Not confirmed by the user.**

### Side panel

- Contents: Outline (headings) and "Tags on this page". Each tag shows this
  page's numbers on the right ("+32m", "+1 done" in green, "2 open"), all-time
  totals below, and its pinned line. No charts or bars.
- Search: query box with operator suggestions, saved searches, results grouped
  by document.
- User wants the panel on the **same background as the page** and is
  exploring how to separate it. Four variants in the switcher:
  **Spacing only**, **Hairline** (1px at ~6% white), **Floating sheet**
  (2–3% lighter, rounded, inset), **Margin column** (no tabs; search box on
  top, page summary below until you type). The user wants more iteration on
  the panel's look; no favourite chosen yet.

## Themes

Verdicts so far:
- Dropped: Quiet (zinc + amber), Focus (zinc + indigo; dislikes purple,
  prefers blue), Flexoki, Rosé Pine, Kanagawa, Everforest, Typora Night
  ("horrific"), Zed One, Vesper, Things (approximated), Apple iOS system
  colours, GitHub dark dimmed, Nord, Atlassian, Adobe Spectrum.
- **Graphite** (hand-picked #151618 + #6ea8fe) was liked but isn't sourced,
  so it doesn't count as a final answer.
- **iA Writer** was promising: the user likes its slightly warm/red-hued
  background, but the cyan accent (#18BEEC) clashed. Research explains why:
  a green-leaning cyan looks muddy on warm grey; a true blue (OKLCH hue
  ~255–265) or an amber/orange works.
- iA Writer, Bear, Things, Linear and Vercel Geist don't publish their colours.

In the switcher now (all values from published sources unless noted):
- **Carbon warm** — IBM Carbon warmGray + blue: bg #171414, raised #272525,
  text #f7f3f2 / #cac5c4 / #8f8b8b, accent #78a9ff, solid #0f62fe, green
  #42be65. Carbon has no warm dark theme; the mapping onto Carbon's g100 layout
  is ours. Best "iA warmth with a working blue" match. Note: Carbon is IBM,
  which may count as "corpo".
- **Carbon g100** — Carbon's official dark theme (#161616, same blues).
  A sourced stand-in for Graphite.
- **Stone · Blue** — Tailwind stone + blue (#1c1917, #60a5fa / #2563eb).
  Built in, but stock Tailwind.
- **Radix Sand · Blue**, **Radix Slate · Blue**, **Radix Sand · Amber**,
  **Radix Mauve · Tomato** — Radix Colors v3 dark scales (12 steps per colour
  with stated roles). Tailwind plugin: `tailwindcss-radix-colors`. Radix blue 9
  with white text is only ~3.3:1. Radix accent scales also have tinted
  near-black step-1 backgrounds (e.g. tomato-1 #181111) for a warmer look.
- **Harmony Sand · Blue** — Evil Martians Harmony (OKLCH, Tailwind v3/v4
  drop-in): sand-950 #18140f, blue-400 #6fc2fa. Its scales have no step
  between 950 and 900, so raised surfaces are a big jump.
- **Minimal Things** — kepano's Minimal theme for Obsidian, "Things" dark
  scheme (#24262a, accent #4d95f7). kepano's own approximation of Things.
- **Graphite** and **iA Writer** (approximate) kept for comparison.

Those were all light blues (#60a5fa–#78a9ff) and looked alike, so the switcher
in the round 4 canvas was replaced with **Harmony iterations only** (plus
Graphite as a reference). One rule maps Harmony steps to roles: page 950,
raised 900, faint marks 800, text 200 / 400 / 600, accent text 400, accent
fill 600 with step-950 text on it, accent tint 900, green-400 or emerald-400
for done. A "lifted" variant puts the page on 900 (raised 800, inputs 950).
Variants: Sand · Indigo (+ lifted), Sand · Blue, Stone · Amber (+ lifted),
Mauve · Orange, Olive · Amber, Neutral · Indigo, Slate · Sky. Harmony's indigo
is a true blue (hue 260), not purple. Harmony greys: neutral, zinc, gray, slate,
stone, sand, olive, mauve; accents include blue, indigo, sky, amber, orange,
red, green, emerald (all OKLCH, same lightness per step).

Latest verdict: the user **likes Harmony neutral** greys and found indigo
purplish. Harmony's non-purple blue is **blue** (hue 240: text #6fc2fa, fill
#0c8aca); sky (210) is cyan. **Neutral · Blue** is now the default, alongside
Neutral · Sky and Neutral · Indigo for comparison. Dropped: all olive, all
"lifted" (page on step 900) variants, and slate. Remaining: Neutral · Blue,
Neutral · Sky, Neutral · Indigo, Sand · Indigo, Sand · Blue, Stone · Amber,
Mauve · Orange, Graphite (reference).

## Open questions

- Which theme direction, after comparing the new ones in the switcher?
- Side panel look: which separation, and whether to drop the tabs (Margin
  column).
- Starting a second timer: keep refusing, or "Switch here" with Undo?
- Fonts: still system-ui. A font switcher (like the theme switcher) was
  suggested as a next step, not yet built.
- Ideas from iOS apps not yet used: Typora-style hiding of markdown syntax
  except on the line being edited.
- Whether Tools (bulk cleanup, tag rename) belong in the palette or a panel
  (currently palette).
