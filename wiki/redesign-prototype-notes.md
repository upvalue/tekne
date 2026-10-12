# Redesign prototype notes

The branch starts from `main`, as agreed: local `master` is 346 commits behind
and lacks the timer and line-colour changes required by the brief.

The theme uses the supplied Harmony hex values directly. Existing component
colour props remain accepted, but all accent variants now use the same blue.
Checkboxes are neutral. The panel separation is in `src/styles/styles.css`.
