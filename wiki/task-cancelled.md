# Task cleanup and a proposed expired state

Task Management currently has one bulk cleanup workflow: find unchecked tasks
created before a chosen date and cancel them. The user previews the proposed
changes, can exclude whole documents, then applies the remaining changes.

The workflow is deliberately document-oriented. It uses `note_lines` to find
documents containing old lines, reads each stored document body to find
untagged tasks too, and leaves `$` template documents out of the proposal. The
apply step updates only the selected documents through the normal document
upsert path, which also rebuilds derived data.

Today, cleanup changes `datumTaskStatus` from `unset` to `incomplete`. In the
UI that is the same cancelled or `x` state a user can set manually.

## Preview behavior

The proposal uses the shared multi-document review UI also used by tag
management. Documents are selectable on the left and the focused document's
line changes appear on the right.

An early version of the preview showed displaced lines and wildly inflated
change counts. Older documents can contain several lines with the same
`timeCreated` value, while the shared diff originally assumed that value was a
unique line ID. Every duplicate then matched the last line with that timestamp.

The shared matcher now groups lines by `timeCreated`, matches unchanged lines
within each group first, then pairs the remaining occurrences in order. This
keeps old documents usable without a data migration. In the production case
used to verify the fix, a document shown with 14 changes actually had no
eligible changes; the corrected preview reports zero.

## Proposed expired state

Add `expired` as a fourth `datumTaskStatus` value. Task Management would set
this status instead of `incomplete` when aging out old unchecked tasks.

The distinction is about intent:

- `incomplete` means the user consciously cancelled the task.
- `expired` means the task aged out through this cleanup workflow.

Only the bulk workflow should enter the expired state. Normal checkbox cycling
should continue to create open, complete, and cancelled tasks, but an expired
task should not be locked. The user should still be able to move it manually
to any ordinary state afterward.

The preview and apply language should change from "Cancel old checkboxes" to
"Expire old tasks", and each proposed row should make the transition explicit:
`unchecked -> expired`. Expired tasks need their own visual treatment, probably
a clock or muted crossed-circle rather than another `x`. Aggregates should
count them separately from completed and cancelled tasks.

`expired` has a slight naming ambiguity because these tasks do not have explicit
deadlines. Here it means "aged out by policy", not "missed its due date". That
seems reasonable as long as the surrounding Task Management copy makes it
clear.

## Alternative data model

If Tekne is likely to gain several ways of closing an unfinished task, the
closure reason could be separated from the task state:

```ts
datumTaskStatus: 'complete' | 'incomplete' | 'unset'
datumTaskResolution?: 'cancelled' | 'expired'
```

That model scales to more resolution reasons, but it adds another field and
requires rules for combinations that should not exist. For this one automated
outcome, adding `expired` directly to `datumTaskStatus` is the simpler proposal.

## Decisions still needed

- Choose the icon and styling for an expired task.
- Decide what clicking an expired checkbox does first: reopen it or complete
  it.
- Decide where expired counts appear in aggregate views and search filters.
- Confirm whether user-facing copy should say "expired" or "aged out".

## Expected implementation work

The change will touch the document schema, task status rendering and cycling,
task cleanup transformation, aggregate handling, proposed-edit copy, and the
tests around each of those areas. Existing stored documents need no migration
because the new enum value only appears after the workflow writes it.
