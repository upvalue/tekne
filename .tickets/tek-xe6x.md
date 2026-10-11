---
id: tek-xe6x
status: closed
deps: []
links: []
created: 2026-08-29T03:02:35Z
type: epic
priority: 2
assignee: Phil
tags: [ui, migration]
---
# Migrate vendor UI kit from Radix + Headless UI to Base UI

Migrate the vendored UI kit (src/components/vendor/) off Radix UI and Headless UI onto Base UI (@base-ui/react, currently 1.7.0 — note the old package name @base-ui-components/react is deprecated; do not use it).

Current state (researched 2026-08-28):

- Radix surface is tiny and fully quarantined behind the vendor seam: only src/components/vendor/Dialog.tsx (@radix-ui/react-dialog) and src/components/vendor/Tabs.tsx (@radix-ui/react-tabs). 10 app call sites, 3 asChild usages, 4 Tailwind class strings keyed on data-[state=...], 1 test (Tools.test.tsx, which asserts aria-selected and therefore survives).
- The rest of the vendor kit is Tailwind Catalyst built on @headlessui/react: Button (~78 refs, biggest consumer), Badge/BadgeButton, Checkbox/CheckboxField, Input, Switch/SwitchField, Link, Popover (pure re-export used once in SavedSearches). All Headless UI imports are inside src/components/vendor/; app code is lint-banned from importing the kits directly (eslint.config.js:44-66 no-restricted-imports).
- Base UI 1.x has equivalents for everything we use: Dialog, Tabs, Button, Checkbox, Switch, Input, Field/Fieldset, Popover.

Why Base UI: single package instead of per-component Radix packages, same team lineage (Radix/Floating UI/MUI), 1.0 stable since Dec 2025, shadcn/ui now supports Base UI as a first-class backend, and it lets us drop both @radix-ui/* and @headlessui/react for one dependency.

Approach: two phases, each a child ticket. Phase 1 (Radix Dialog/Tabs) is small and mechanical; phase 2 (Catalyst/Headless UI components) is larger because Catalyst styling is keyed on Headless UI data attributes (data-hover, data-focus, data-active) that Base UI does not emit. Keep the vendor seam exports stable so app call sites barely change.

Key API differences (Radix → Base UI): Overlay → Backdrop, Content → Popup (Dialog); Trigger → Tab, Content → Panel (Tabs); asChild → render prop; data-state="open" → data-open/data-closed; data-state="active" → data-selected; forceMount → keepMounted; animations get data-starting-style/data-ending-style hooks.

References:

- https://base-ui.com/react/components/dialog
- https://base-ui.com/react/components/tabs
- shadcn Radix→Base UI migration discussion: https://github.com/shadcn-ui/ui/discussions/9562

## Notes

**2026-08-29T03:49:30Z**

Both phases implemented and closed. Remaining follow-up: visual QA in a real browser (hover/focus/active/dark-mode states, dialog animations, SavedSearches popover positioning).
