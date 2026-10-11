---
id: tek-bggv
status: open
deps: []
links: []
created: 2026-08-29T02:47:46Z
type: bug
priority: 1
assignee: Phil
tags: [editor, persistence, data-loss]
---
# Prevent autosave races from losing editor changes

The editor currently tracks unsaved work with one boolean and writes whole-document snapshots on an interval. If the document changes while a request is in flight, the older request can succeed and set `docDirty` to false even though the newer edit was not in that request. A slow request can also overlap with later interval saves using the same `expectedRevision`; the resulting conflict path marks the document clean and reloads the server copy, discarding local work.

The tag-rename save bridge has a related problem: it proceeds after a 1.5 second timeout even when the editor save is still running or has failed.

## Design

Replace the dirty boolean and interval polling in `useDocumentSync` with a serialized per-document save queue.

Increment a client-local generation for every `docAtom` change except hydration. A save captures the current generation, immutable document snapshot, and server revision. Allow only one update request in flight. On success, acknowledge only the captured generation; if a newer generation exists, leave the document dirty and schedule another save.

Schedule network saves 750 ms after the latest edit, with a maximum wait of 5 seconds after the first unsaved edit. Explicit flushes for navigation and cross-tree operations must drain all generations, including edits made during an earlier request.

Detect hydration explicitly: writes of server content into `docAtom` set a suppression flag so they do not bump the generation. Do not rely on reference equality with the query data — `docAtom`'s write function runs values through `ensureUniqueLineTimeCreateds`, so the stored object may not be the query's object.

On save success, write the saved snapshot and new revision into the `loadDoc` query cache (`setQueryData`) instead of letting the re-enabled query refetch. Hydrate the store from query data only when no unacked generations exist and the server revision differs from the last acknowledged one; this keeps a refetch from clobbering edits made after an ack and stops `resetUndoHistory` from running after ordinary saves.

Keep local contents and dirty state on network errors; retry with the existing debounce. Revision conflicts get a resolution path instead of a retry loop or a reload. Change `updateDoc` to return a discriminated result — `{ status: 'ok', revision }` or `{ status: 'conflict', serverDoc, serverRevision }` — rather than throwing CONFLICT, so the client learns the server state in the same round trip. On conflict, pause autosave for the document, keep it dirty, and prompt the user: keep mine (resend with `expectedRevision` = `serverRevision`) or take server (hydrate `serverDoc`, drop local generations). A line-identity merge using `timeCreated` ids is a possible follow-up, not part of this fix.

Replace the tag-rename timeout callback with a real flush promise. The dispatch is synchronous, so the editor's listener attaches its flush promise to `event.detail`; if no promise is present after dispatch, no editor is mounted and the rename proceeds immediately. A rejected flush aborts the server-side rewrite with an error toast. Convert `saveDocument`'s callback parameter to a returned promise and update its callers: the navigation blocker, the unload handler, `internalLinkClick` in `routes/n/$title.tsx`, and the agent panel's apply step, which currently dispatches the save event and closes without waiting.

Navigation with unsaved work waits for the drain. If the drain fails or a conflict is unresolved, block navigation but present the same resolution choices (including explicit discard) so the user is never stuck.

Trigger a best-effort flush on visibility/page lifecycle events and prompt on browser unload while dirty. IndexedDB recovery for browser crashes, killed tabs, and offline use should be handled in a separate follow-up; the queue fix cannot guarantee completion of unload-time networking.

## Acceptance Criteria

1. An edit made while a save is pending is sent in a later request and remains dirty until that request is acknowledged.
2. At most one `updateDoc` request is in flight per open document.
3. Rapid edits are debounced, while continuous editing is saved at least every 5 seconds.
4. Navigation flush waits until all observed edit generations are acknowledged; on failure or unresolved conflict it blocks and offers resolution or explicit discard rather than leaving the user stuck.
5. Tag rename waits for the real editor flush, does not continue after a failed save, and proceeds immediately when no editor is mounted.
6. Network failures preserve `docAtom` and the unsaved state.
7. A revision conflict pauses autosave, preserves local content, and offers keep-mine (overwrite at the server's revision) or take-server (hydrate the conflict response); it never silently reloads or retries in a loop.
8. A successful save updates the `loadDoc` query cache; no refetch or hydration overwrites unacked local edits or resets undo history after a save.
9. A dirty document requests browser unload confirmation and starts a best-effort lifecycle flush.
10. Tests cover edits during an in-flight request, request serialization, debounce and maximum wait, failed saves, conflict resolution both ways, post-save cache updates, navigation draining, tag-rename failure, and tag-rename with no editor mounted.


## Notes

**2026-08-29T03:13:52Z**

Implemented: SaveQueue (src/editor/save-queue.ts) + useDocumentSync rewrite + updateDoc conflict result + SaveConflictDialog + promise-based tekne:request-save handshake (requestEditorFlush in lib/app-events.ts). Found during browser testing: React StrictMode runs effect cleanup+setup on the same memoized queue, so dispose() must be reversible — added SaveQueue.activate(). Verified in dev:client-only with playwright: debounced saves, persistence, conflict dialog both resolutions, undo surviving saves and take-server, tag rename flush, navigation flush of a pending edit.
