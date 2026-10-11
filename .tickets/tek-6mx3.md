---
id: tek-6mx3
status: closed
deps: []
links: []
created: 2026-08-29T03:03:05Z
type: task
priority: 2
assignee: Phil
parent: tek-xe6x
tags: [ui, migration]
---
# Replace Radix Dialog/Tabs vendor components with Base UI

Replace @radix-ui/react-dialog and @radix-ui/react-tabs with @base-ui/react in the two vendor wrappers, keeping the exported component names and data-slot attributes stable so app call sites need minimal changes.

## Code changes

1. Dependencies: `pnpm remove @radix-ui/react-dialog @radix-ui/react-tabs && pnpm add @base-ui/react` (1.7.0+; NOT the deprecated @base-ui-components/react).

2. src/components/vendor/Dialog.tsx — reimplement on `import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'`. Part mapping: Root→Root, Trigger→Trigger, Portal→Portal, Overlay→**Backdrop**, Content→**Popup**, Title/Description/Close unchanged. Keep exports (Dialog, DialogTrigger, DialogPortal, DialogClose, DialogOverlay, DialogContent + showCloseButton, DialogHeader, DialogFooter, DialogTitle, DialogDescription) and keep DialogContent auto-rendering Portal + Backdrop internally. Prop types become e.g. `DialogPrimitive.Popup.Props`. Controlled `open`/`onOpenChange` on Root carries over as-is (note: Base UI onOpenChange receives (open, eventDetails) — extra args are fine for our setState-style handlers).

3. src/components/vendor/Tabs.tsx — reimplement on `import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'`. Part mapping: Root→Root, List→List, Trigger→**Tab**, Content→**Panel**. Keep exports Tabs/TabsList/TabsTrigger/TabsContent. `value`/`onValueChange` are compatible (both call sites are controlled string-valued; no defaultValue/orientation/activationMode used anywhere).

4. Tailwind state selectors (only 4 lines in the repo, all in these 2 files):
   - Dialog.tsx:39 (Overlay) and :61 (Content): `data-[state=open]:` → `data-open:`, `data-[state=closed]:` → `data-closed:` (tw-animate-css animate-in/animate-out utilities keep working; Base UI, like Radix, waits for exit animations before unmounting). If animate-out proves flaky, the Base UI-native alternative is transitions keyed on `data-starting-style`/`data-ending-style`.
   - Dialog.tsx:70 (auto close button): `data-[state=open]:bg-zinc-100` etc. — Base UI's Close does not carry open-state data attributes; the button only exists while open, so make these styles unconditional (drop the variant prefix).
   - Tabs.tsx:43: `data-[state=active]:` → `data-selected:`.

5. asChild → render (all 3 occurrences in repo):
   - src/dev/PgliteDevtools.tsx:255 `<DialogTrigger asChild><Button/></DialogTrigger>` → `<DialogTrigger render={<Button/>}>label</DialogTrigger>`
   - src/dev/PgliteDevtools.tsx:383 same for `<DialogClose asChild>`
   - src/editor/TimerBadge.tsx:133 — see refactor below.

6. Real refactors (not mechanical):
   - src/editor/TimerBadge.tsx:124-281: (a) `DialogTrigger asChild` wraps a div containing a BadgeButton that also has its own onClick setOpen(true) — double-fire risk; since the dialog is controlled anyway, either drop DialogTrigger and keep the onClick, or use `render={<BadgeButton/>}` and drop the manual onClick. (b) It renders `<DialogOverlay>` as a *wrapper element around* EditorDialogContent, while EditorDialogContent→DialogContent already renders its own Portal+Overlay — an overlay nested in an overlay. Base UI's Backdrop does not take content children; delete the wrapper DialogOverlay and let DialogContent provide the backdrop.
   - src/editor/DocumentDetails.tsx:39-50: nested `<DialogContent>` inside `<DialogContent>` (line 48) double-portals — remove the inner one. DialogTrigger wraps a bare FileText icon with no asChild (relies on the default rendered button) — works the same in Base UI; just re-check styling.

7. ESLint seam: eslint.config.js:44-66 — in no-restricted-imports, replace the `@radix-ui/*` pattern with `@base-ui/*` (keep @headlessui/react banned until the phase-2 ticket lands).

8. Other call sites (TitleBar.tsx, TemplateDialog.tsx, TagRenameDialog.tsx, CancelStaleTasks.tsx, Tools.tsx, DevTools.tsx, EditorDialogContent.tsx) use only the vendor exports with controlled open/value props — should compile unchanged; eyeball each after the swap.

Option worth considering before hand-porting: components.json is standard shadcn (new-york, alias ui→@/components/vendor); shadcn/ui now publishes Base UI-backed dialog/tabs, so re-vendoring from their registry and re-applying our diffs (data-slot names, showCloseButton, zinc literal colors since cssVariables:false) may be faster and closer to upstream.

## Verification

- `pnpm check` (tsc + eslint + prettier + depcruise) and `pnpm test`.
- Tools.test.tsx asserts aria-selected and drives tabs with focus + Enter — expected to pass under Base UI (Tab renders role=tab, aria-selected); fix activateOnFocus on TabsList if the focus-switch test behaves differently.
- Manual pass in dev server: every dialog (DocumentDetails, TitleBar confirm, TemplateDialog, TimerBadge, TagRenameDialog, CancelStaleTasks, PgliteDevtools) — open/close animation, backdrop click, Escape, focus trap; both tab sets (Tools panel, DevTools).


## Notes

**2026-08-29T03:43:36Z**

Done: vendor Dialog/Tabs reimplemented on @base-ui/react 1.7.0; asChild sites converted to render; TimerBadge overlay-wrapper and DocumentDetails nested-content refactored; eslint seam now bans @base-ui/* outside vendor. Added src/components/vendor/Dialog.test.tsx. pnpm check green; unit project 393 tests green. Note: the vitest browser project cannot run on this machine (no runnable chromium on NixOS; pre-existing, unrelated).
