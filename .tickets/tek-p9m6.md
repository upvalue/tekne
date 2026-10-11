---
id: tek-p9m6
status: closed
deps: [tek-6mx3]
links: []
created: 2026-08-29T03:03:10Z
type: task
priority: 2
assignee: Phil
parent: tek-xe6x
tags: [ui, migration]
---
# Migrate Catalyst/Headless UI vendor components to Base UI

Replace the Tailwind Catalyst components (built on @headlessui/react) in src/components/vendor/ with Base UI equivalents, then drop the @headlessui/react dependency. Depends on the phase-1 ticket (which introduces @base-ui/react and the eslint seam change).

All Headless UI usage is already confined to src/components/vendor/ (lint-enforced), so app call sites only change where component APIs leak through (notably Button's props type).

## Component mapping

| Vendor file | Today (Catalyst) | Base UI replacement |
|---|---|---|
| Button.tsx (~78 app refs) | Headless.Button + TouchTarget, renders Link when href present | @base-ui/react Button (useRender-based; supports render prop, nativeButton={false} for link-buttons) |
| Badge.tsx / BadgeButton | span / Headless.Button | span stays; BadgeButton → Base UI Button |
| Checkbox.tsx + CheckboxField | Headless.Checkbox + Headless.Field | Checkbox.Root/Indicator + Field.Root/Label |
| Input.tsx | Headless.Input | @base-ui/react Input (+ Field for label/error wiring) |
| Switch.tsx + SwitchField | Headless.Switch + Headless.Field | Switch.Root/Thumb + Field |
| Link.tsx | Headless.DataInteractive wrapper | plain anchor (or useRender); resolve the old Catalyst router TODO by rendering @tanstack/react-router Link |
| Popover.tsx | pure re-export of headlessui Popover/PopoverButton/PopoverPanel | Popover.Root/Trigger/Positioner/Popup |

## The real work: styling attribute vocabulary

Catalyst styles are keyed on Headless UI data attributes that Base UI does NOT emit: data-hover, data-focus, data-active, plus group-data-hover: variants (heavily used in the Badge.tsx color map and throughout Button.tsx/Switch.tsx/Checkbox.tsx).

Rewrite to native Tailwind variants and Base UI attributes:
- data-hover: → hover:  |  data-focus: → focus-visible:  |  data-active: → active:
- data-checked / data-disabled → Base UI emits these same names on Checkbox/Switch (plus data-unchecked); mostly carries over
- group-data-hover: → group-hover:

This is a find/replace per vendor file followed by visual QA of every state (hover, focus ring, active, disabled, checked, dark mode) — the Catalyst files are long (Button 216 lines, Switch 198, Checkbox 160) and the class strings are dense.

## Call-site changes

- Popover: src/panel/SavedSearches.tsx (only consumer) — headlessui's PopoverButton/PopoverPanel with anchor prop becomes Trigger + Positioner (side/align/sideOffset props) + Popup; close-on-click-item comes for free, but re-check focus return.
- Checkbox consumers (ELine.tsx, ReadOnlyLine.tsx, DocumentEditsReview.tsx, TagRenameDialog.tsx): Base UI Checkbox.Root renders a button with role=checkbox, so DocumentEditsReview.test.tsx getByRole('checkbox', {name}) keeps working; onChange signature changes from Headless (checked => void) to Base UI onCheckedChange(checked, eventDetails).
- Switch consumers (TimerBadge.tsx x3): onChange → onCheckedChange.
- Button consumers: if we keep the vendor Button's public props (color/outline/plain/href), ~78 call sites stay untouched; only the internal implementation and the ButtonProps type change.
- Remove @headlessui/react from package.json and from the eslint no-restricted-imports ban once nothing imports it.

## Verification

- pnpm check && pnpm test (DocumentEditsReview.test.tsx exercises the Checkbox by role — must stay green).
- Visual QA across the app for Button/Badge states (hover/focus/active/disabled, dark mode), Switch and Checkbox toggling, Input focus styles, SavedSearches popover positioning.


## Notes

**2026-08-29T03:49:30Z**

Done: Button/Badge/Checkbox/Switch/Input rebuilt on @base-ui/react primitives keeping Catalyst styling (data-hover/focus/active converted to hover:/focus-visible:/active:; data-checked/disabled/indeterminate carry over since Base UI emits the same names). CheckboxField/SwitchField are plain divs (Headless Field association was unused). Link dropped DataInteractive. Popover vendor seam now wraps Base UI Portal+Positioner+Popup with anchor-width matching; SavedSearches converted to controlled open state. Call sites: onChange->onCheckedChange (5 sites). @headlessui/react removed. Added PointerEvent polyfill in src/test-setup.ts for jsdom (Base UI needs it). pnpm check green, 393 unit tests green. Visual QA in a real browser still recommended (no runnable browser on this machine).
