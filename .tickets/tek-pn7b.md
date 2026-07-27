---
id: tek-pn7b
status: open
deps: []
links: [tek-hle5]
created: 2026-07-27T04:19:22Z
type: epic
priority: 2
assignee: Phil
tags: [cleanup, ui, frontend]
---
# Migrate to latest shadcn/ui on Base UI; retire Catalyst progressively

Two design systems coexist: vendored Tailwind Catalyst (headlessui, ~1131 lines in src/components/vendor/) and shadcn/ui (radix: Dialog, Tabs, Sonner, 228 lines). components.json points at @/components/ui which does not exist. Decision 2026-07-27: keep the intentional Catalyst vendoring history in mind, but converge on latest shadcn/ui with Base UI primitives (the ex-Radix team's library) as the single system. Related: dead Catalyst pieces (CatalystDialog, text.tsx) already covered by tek-hle5. Latent bug worth fixing early regardless of system: src/components/vendor/link.tsx renders a bare <a> (unfixed Catalyst boilerplate TODO), so every Catalyst Button/Badge href= does a full page reload instead of a TanStack Router navigation.

## Design

1) Fix link.tsx to use TanStack Router Link (standalone, do first). 2) Fix components.json paths; re-init with current shadcn CLI on Base UI. 3) Regenerate Dialog/Tabs/Sonner on Base UI. 4) Progressively replace live Catalyst components (Button, Input, Switch, Badge, Checkbox, Navbar, DescriptionList) as files are touched; delete each Catalyst file when its last importer migrates. 5) Finish by removing @headlessui/react and pruning unused Catalyst sub-exports (CheckboxGroup, InputGroup, NavbarDivider, SwitchGroup, TextLink, Strong, Code, DialogBody, DialogActions).

## Acceptance Criteria

Single component system under @/components/ui; @headlessui/react and src/components/vendor/ removed; internal navigation via router Link (no full reloads); no visual regressions on Panel, dialogs, settings.

