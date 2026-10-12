# Redesign prototype notes

The branch starts from `main`, as agreed: local `master` is 346 commits behind
and lacks the timer and line-colour changes required by the brief.

The theme uses the supplied Harmony hex values directly. Forced font smoothing
has been removed. The narrower, darker sidebar has a soft edge, descriptive
icon tooltips, and its original tools. Calendar controls sit above the muted
18px title; Today is inside the calendar.

Editor rows fill the available width, including empty rows. Timestamps, drag
handles, and action menus occupy fixed gutter columns across indentation levels.
The original line icons and checkbox shape are restored. The writing prompt
appears only after the document: four selectable styles generate five randomized
marks per new line, stable while typing. Loading has separate animated variants.

Inline timers have spaced controls and no drop shadow. The line action menu
uses a dark rounded surface; autocomplete uses the same palette with a lighter
shadow. Checkbox status changes no longer raise notification popups. Keyboard
commands and timer shortcuts are retained. Page navigation preloads content and
updates the title and editors before paint to avoid mismatched text flashes.

Dev tools → Appearance & errors previews loading and writing styles, recoverable
errors, long messages, notifications, and save conflicts. Stored data formats
are unchanged. Nothing has been deployed to production.

Validation: `pnpm check` passes, and `pnpm test` passes all 480 tests across 64
files. Browser checks covered fixed gutter alignment, far-right and empty-line
focus, timer controls and shortcuts, countdown completion, autocomplete, calendar
navigation, sidebar tooltips, randomized prompts, mobile overflow, and navigation
frames. The previously observed empty countdown fixture line did not recur:
its content survived countdown completion and a reload. No root cause was
established for the earlier observation.

This remains a design checkpoint for further visual review.
