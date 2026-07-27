---
id: tek-kjmb
status: closed
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


## Notes

**2026-07-27T06:13:14Z**

aggregateTagData in src/trpc/lib/tag-aggregates.ts owns the task, timer and pin
queries plus the filter block that used to be pasted around them. Tag discovery
stayed in the routers: analysis wants the tags in one document ordered by first
use, search wants tags matching a prefix and the query filters. Those aren't the
same query wearing two hats, so there was nothing to share.

analysis.ts went 207 -> 66 and the aggregate half of search.ts 160 -> 12,
against 188 shared lines. Not the 370 -> 100 the ticket guessed, but the
duplication is gone.

Template exclusion is one flag now, and it covers pins. The page-scoped call
passes false: it has already named a document, and a template's own page would
otherwise report nothing about itself.

Pin-max is DISTINCT ON (datum_tag) with ORDER BY datum_pinned_at DESC. It also
drops rows whose datum_pinned_at is null, which under DESC sort first in
Postgres -- so search could take an unpinned row over a real pin.

The two TagAggregateData types are one. Base fields are required and zero-filled
the way search always did it; page_* stay optional since only analysis fills
them. analysis used to leave out tags with no data anywhere, so hasAggregateData
keeps that rather than start rendering empty cards. Dead total_tasks select
dropped.

Something I wasn't looking for: COUNT and SUM come back as bigint, which the
driver hands over as strings, and both routers have always typed them as
numbers. The client compares with > 0 so the coercion hid it. There are ::int
casts now, which does change the wire format from "1" to 1.

Twelve tests against a real PGlite instance in-process, node environment rather
than jsdom. First tests any of the router code has had.

Checked it in the browser with a template holding a pin *newer* than the real
document's. Aggregate shows PIN FROM REAL DOC and one complete task instead of
two; the search aggregate agrees. Before this that template pin would have won.
