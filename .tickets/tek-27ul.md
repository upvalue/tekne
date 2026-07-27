---
id: tek-27ul
status: closed
deps: []
links: []
created: 2026-07-27T04:14:02Z
type: chore
priority: 3
assignee: Phil
tags: [cleanup, editor]
---
# Prune vendored codemirror dom.ts from 512 lines to the 2 used helpers

src/editor/line-editor/vendor/dom.ts is 512 lines of unmodified CodeMirror internal source with 25 exports. Exactly one consumer exists: src/editor/line-editor/placeholder-plugin.ts imports clientRectsFor and flattenRect (~20 lines combined). The rest (getSelection, scrollRectIntoView, dispatchKey, IE-era workarounds, 8 'as any' casts) is dead. These helpers are not exported from @codemirror/view public API, hence the vendoring.

## Design

Inline clientRectsFor + flattenRect (plus their tiny dependencies) into placeholder-plugin.ts or a small vendor/dom.ts stub with an attribution comment; delete everything else.

## Acceptance Criteria

vendor/dom.ts reduced to only used code; placeholder plugin still renders correctly in /lab.


## Notes

**2026-07-27T05:24:03Z**

512 -> 35 lines. Dependency closure was smaller than expected: clientRectsFor needs only the private textRange (+ its scratchRange), flattenRect needs only the Rect interface. Kept it as vendor/dom.ts rather than inlining into placeholder-plugin.ts so the 'this is upstream code, not ours' signal survives, with an attribution header naming @codemirror/view 6.38.1 and the reason for vendoring (neither helper is in the public API).

Checked the runtime path in the browser. Emptied the doc in /lab to trigger the placeholder (renders 189x22), then called view.coordsAtPos(0) via the DOM's cmView handle. Returns left === right === 194 at the placeholder's position, which is flattenRect collapsing a live clientRectsFor rect -- so both helpers and the private textRange all executed.
