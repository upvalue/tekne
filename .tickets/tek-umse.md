---
id: tek-umse
status: closed
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

## Notes

**2026-07-27T05:53:51Z**

deriveNoteRows lives in server/lib/docs.ts and returns { parsedBody, noteData,
noteLines }. Both writers keep their own deletes and inserts. processDocumentForData
stays exported but is now only called from deriveNoteRows.

linesToZodDoc is gone and treeifyDoc gets the real doc. No behavior change today
-- CURRENT_SCHEMA_VERSION is 1, which is what the synthetic doc hardcoded -- so
this only matters once something branches on the version. There's a test pinning
it (a doc at schemaVersion 99 still extracts its tag) so the plumbing doesn't
quietly regress.

Four tests in server/lib/docs.test.ts, the first for either of these files.
Tags keep their '#' in datum_tag, which surprised me; the test records it.

Checked the round trip against pglite in the browser rather than trusting the
unit tests. Created a doc, typed a tagged line, then read the tables directly:
revision 1, one note_data row (#umse-check, line 0), one note_lines row, one
parsed_body entry. Ran Recompute Data twice from the Dev panel -- it reproduced
the same rows and left revision at 1 both times, which covers the "identical
before/after" and "revisions untouched" criteria in one go.

