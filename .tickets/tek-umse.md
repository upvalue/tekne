---
id: tek-umse
status: open
deps: []
links: []
created: 2026-07-27T04:19:13Z
type: task
priority: 2
assignee: Phil
tags: [cleanup, backend]
---
# Consolidate doc-derivation logic; fix synthetic schemaVersion in recompute path

upsertNoteInTx (trpc/routers/doc.ts:40-46, 80-87) and recomputeAllDocumentData (server/lib/docs.ts:61-67, 82-89) duplicate two blocks verbatim: the per-line parsedBody build (TEKNE_MD_PARSER.parse + jsonifyMdTree) and the noteLines row build. processDocumentForData is already shared. The differing transaction choreography is legitimate and should stay (upsert: per-note delete + revision bump; recompute: global wipe, no revision change). Bug: linesToZodDoc (docs.ts:10-16) rebuilds a synthetic ZDoc from doc.children with hardcoded schemaVersion: 1, an unused title param, and Array<any> typing — processDocumentForData already receives the full ZDoc, so if analysis ever branches on schema version, recompute silently analyzes at v1. (Note: it does NOT write schemaVersion to the DB — analysis-only.)

## Design

Delete linesToZodDoc; pass doc straight to treeifyDoc(doc). Extract deriveNoteRows(title, body) -> { parsedBody, noteData, noteLines } in server/lib/docs.ts; both writers consume it and keep their own delete/insert choreography.

## Acceptance Criteria

linesToZodDoc removed; parsedBody/noteLines built in exactly one place; upsert still bumps revision, recompute still leaves revisions untouched; derived rows identical before/after for existing docs.

