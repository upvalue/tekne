---
id: tek-kjmb
status: open
deps: []
links: []
created: 2026-07-27T04:19:07Z
type: task
priority: 2
assignee: Phil
tags: [cleanup, backend, sql]
---
# Consolidate tag-aggregate SQL between analysis and search routers

analysis.aggregateData (analysis.ts:26-207) and search.searchAggregate (search.ts:331-492) independently implement the same per-tag aggregation over note_data. Verbatim duplication: status-count CASE select block x3 (analysis.ts:64-73, 107-115, search.ts:383-391), timer SUM block x3, and the fromDate/toDate/docPattern filter block pasted x4 inside searchAggregate alone. TagAggregateData is declared twice with incompatible shapes (analysis: all optional, pinned_at?: Date; search: all required, pinned_at: Date | null). Already diverged: template exclusion (note_title not ilike '$%') applied inconsistently within and between them — both fail to exclude templates from pin queries, so a pin in a template doc can win most-recent-pin. Pin-max implemented twice (JS scan in analysis.ts:182-199 with 'Should be done in SQL' comment vs ORDER BY desc first-wins in search). analysis.ts:73 selects total_tasks that nothing reads.

## Design

One shared builder, e.g. src/trpc/lib/tag-aggregates.ts: aggregateTagData(db, tags, { docTitle?, fromDate?, toDate?, docPattern?, excludeTemplates }) owning the four query shapes, filter application, and pin-max in SQL (e.g. DISTINCT ON (datum_tag)). analysis calls it twice (global + page-scoped), search once with filters. Single exported TagAggregateData type. Make template exclusion one deliberate, documented decision including pins. Add tests for the shared builder while touching it (routers currently have zero tests).

## Acceptance Criteria

Both procedures return the same results as before for non-template data (snapshot before/after); one TagAggregateData type; duplicated blocks gone (~370 lines -> ~100); template exclusion behavior consistent and documented.

