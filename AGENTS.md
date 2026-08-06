# tekne

Tekne is a freestyle productivity app: an outline editor where users tag
chunks of text, record structured data (such as time spent on a task), and
search or navigate that data.

User-local configuration is in `AGENTS.local.md`; read that as well before
beginning work.

## Conventions

- docs/ are hand-written human docs, don't alter them
- agentic docs can go into wiki/
- `ticket --help` can be used to view and manage tickets
- Code is grouped by feature (`src/editor`, `src/db`, …) and directionally layered
- Tests live next to the file they test, not in a separate tests folder.
