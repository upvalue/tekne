# Tekne HTTP API

Tekne exposes all 30 document, search, tag, task, flag and hook operations as
plain JSON at `/api/v1`. Open `/api` on your Tekne host for the endpoint
reference and request/response schemas. Download `/api/openapi.json` for an
OpenAPI 3.1 specification suitable for client generators in other languages.
Both are generated from the running oRPC router.

The API uses the app's existing network access. There is no separate API key
or per-user authorization. A caller who can reach the server can read and
change its data. The deployed instance is accessed through its Tailscale host.

## Curl quick start

Set `BASE` to your Tekne host, without a trailing slash. This walkthrough
creates and removes a scratch document. It requires curl and jq.

```sh
BASE=http://localhost:3005

curl --fail-with-body -sS "$BASE/api/v1/documents" \
  -H 'Content-Type: application/json' -d '{"name":"API scratch"}'

curl --fail-with-body -sS -G "$BASE/api/v1/documents/content" \
  --data-urlencode 'name=API scratch' > /tmp/tekne-document.json

# Preserve the document structure and use the revision from the read.
jq '{name:"API scratch", expectedRevision:.revision, doc:.doc}
    | .doc.children[0].mdContent = "Work from curl #project"
    | .doc.children[0].datumTimeSeconds = 300
    | .doc.children[0].timeUpdated = (now | todateiso8601)' \
  /tmp/tekne-document.json > /tmp/tekne-update.json

curl --fail-with-body -sS -X PUT "$BASE/api/v1/documents/content" \
  -H 'Content-Type: application/json' --data-binary @/tmp/tekne-update.json

curl --fail-with-body -sS "$BASE/api/v1/search/lines" \
  -H 'Content-Type: application/json' \
  -d '{"operators":[{"type":"tag","value":"#project"}],"limit":10}'

curl --fail-with-body -sS -X DELETE "$BASE/api/v1/documents" \
  -H 'Content-Type: application/json' -d '{"name":"API scratch"}'
```

GET requests use query parameters. POST, PUT and DELETE requests use JSON
bodies. Empty maintenance requests need no body. Responses are the result
itself, with no RPC envelope. Dates are ISO 8601 strings and the body limit is
10 MiB. Use `--data-urlencode` for query values containing spaces, slashes or
other punctuation. Document names are never part of the endpoint path.

Creation, deletion and rename retain the editor's name validation: 1–255
characters, ASCII letters/digits, whitespace and the punctuation allowed by
`src/docs/validation.ts`. A leading `$` denotes a template. Reading an existing
document uses its exact stored title.

## Python without an SDK

```python
import json
from urllib.request import Request, urlopen

base = "http://localhost:3005/api/v1"
request = Request(
    base + "/search/lines",
    data=json.dumps({"operators": [], "limit": 10}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urlopen(request) as response:
    page = json.load(response)
for line in page["items"]:
    print(line["note_title"], line["content"])
# If nextCursor is present, send it as cursor with the same operators.
```

## Documents and revisions

`GET /documents/content?name=...` returns `{doc, revision}`. A current document
has `type: "doc"`, `schemaVersion: 1` and a `children` array. Each line has
`type: "line"`, `mdContent`, numeric `indent`, and ISO UTC `timeCreated` and
`timeUpdated`. Optional fields include `collapsed`, `datumTimeSeconds`,
`datumTaskStatus` (`complete`, `incomplete`, `unset`), `datumPinnedAt`, and
`color` (`yellow`, `blue`, `purple`, `red`, `green`). Time is in seconds.
Reads and conflict responses preserve legacy fields so older documents can
still be migrated. The reference describes the current document shape;
`GET /maintenance/documents/validation` reports stored documents that differ.

PUT the complete `{name, doc, expectedRevision}` to `/documents/content`.
This replaces the document and rebuilds its derived search and tag data.
A save returns `{status:"ok", revision}`. If the stored revision changed, the
response is HTTP 200 with `{status:"conflict", serverDoc, serverRevision}` and
nothing is written. Reconcile that document before retrying. A missing document
with an expected revision returns 404. Omitting `expectedRevision` performs an
unconditional upsert, including creation when the title is absent.

## Search and pagination

`POST /search/lines` takes `operators`, optional `limit` (default 50, maximum 100) and optional `cursor`. It returns `items` and, when more results exist,
`nextCursor`. Send that number as the next request's cursor. The cursor is an
offset; edits between requests may shift page boundaries. Templates are
excluded. Empty operators match all non-template lines.

| Operator     | Value                                                                |
| ------------ | -------------------------------------------------------------------- |
| `tag`        | Prefix including `#`, such as `#project`                             |
| `doc`        | Document title glob, such as `2026-*`                                |
| `from`, `to` | ISO date-time; from is inclusive and to includes its whole day       |
| `age`        | Number of days back from now                                         |
| `status`     | `complete`, `incomplete`, or `unset`                                 |
| `has`        | `timer`, `task`, or `pin`                                            |
| `text`       | Text plus a `wildcard` field: `none`, `prefix`, `suffix`, or `exact` |

`POST /search/aggregates` takes the same operators array but supports only
`tag`, `doc`, `from`, `to` and `age`. Other operators return 400. Tag management
uses names without `#`; search operators include it.

## Errors and previews

Errors use HTTP status codes and an oRPC error object, for example:

```json
{
  "defined": true,
  "code": "NOT_FOUND",
  "status": 404,
  "message": "Document \"Missing\" not found"
}
```

Validation failures use 400 and may include `data.issues`. Missing resources
use 404; duplicate document names and stale bulk revisions use 409. Unexpected
failures use 500. Branch on status and code rather than the human-readable
message. Document save conflicts are the HTTP 200 result described above.
Unknown routes return 404 with `{error:"API route not found"}`.

Document and tag rename previews are advisory; execution recalculates their
changes inside a transaction. Stale-task cancellation previews return
`documents` with revisions. Select the desired documents and send the same
`cutoff` with `documents:[{title,expectedRevision}]` to the execute endpoint.
A stale revision returns 409 and rolls back the whole operation. Cancellation
changes `unset` tasks to `incomplete` and excludes templates.

Maintenance routes affect all documents. Migration changes document bodies
and revisions when required; recomputation rebuilds only derived data.

## Endpoint map

All paths below are relative to `/api/v1`. The live `/api` reference has the
complete input and output schema for each operation.

| Operation                   | Method | Path                                |
| --------------------------- | ------ | ----------------------------------- |
| `doc.searchDocs`            | GET    | `/documents`                        |
| `doc.loadDoc`               | GET    | `/documents/content`                |
| `doc.loadDocDetails`        | GET    | `/documents/details`                |
| `doc.updateDoc`             | PUT    | `/documents/content`                |
| `doc.renameDocPropose`      | POST   | `/documents/rename/preview`         |
| `doc.renameDocExecute`      | POST   | `/documents/rename`                 |
| `doc.createDoc`             | POST   | `/documents`                        |
| `doc.validateAllDocs`       | GET    | `/maintenance/documents/validation` |
| `doc.migrateAllDocs`        | POST   | `/maintenance/documents/migrate`    |
| `doc.recomputeAllData`      | POST   | `/maintenance/documents/recompute`  |
| `doc.deleteDoc`             | DELETE | `/documents`                        |
| `doc.listTemplates`         | GET    | `/templates`                        |
| `doc.createDocFromTemplate` | POST   | `/documents/from-template`          |
| `analysis.aggregateData`    | GET    | `/analysis/document`                |
| `search.searchLines`        | POST   | `/search/lines`                     |
| `search.searchAggregate`    | POST   | `/search/aggregates`                |
| `search.getSavedSearches`   | GET    | `/saved-searches`                   |
| `search.saveSearch`         | POST   | `/saved-searches`                   |
| `search.deleteSavedSearch`  | DELETE | `/saved-searches`                   |
| `flags.getAll`              | GET    | `/flags`                            |
| `flags.set`                 | PUT    | `/flags`                            |
| `tags.list`                 | GET    | `/tags`                             |
| `tags.allTags`              | GET    | `/tags/suggestions`                 |
| `tags.setArchived`          | PUT    | `/tags/archive`                     |
| `tags.setDescription`       | PUT    | `/tags/description`                 |
| `tags.renamePropose`        | POST   | `/tags/rename/preview`              |
| `tags.renameExecute`        | POST   | `/tags/rename`                      |
| `tasks.cancelStalePropose`  | POST   | `/tasks/cancel-stale/preview`       |
| `tasks.cancelStaleExecute`  | POST   | `/tasks/cancel-stale`               |
| `execHook`                  | POST   | `/hooks/timer`                      |

## Client and deployment migration

The React app uses oRPC's RPC transport at `/api/rpc` and TanStack Query helpers.
The public JSON routes and the RPC transport call the same procedures and
validation. `/api/trpc` has been removed; existing tRPC integrations must move
to the HTTP endpoints above. No database migration is required for this change.

Set `TEKNE_ORPC_URL` at frontend build/dev-server time when using a separate
backend, for example `http://localhost:3005/api/rpc`. This replaces
`TEKNE_TRPC_URL`. Production defaults to `/api/rpc` on the same origin.
`pnpm dev:client-only` still runs the router against PGlite in the browser;
`pnpm dev:client-and-server` connects to the backend. Production bundles omit
the local router and PGlite assets.

The response schemas live in `src/api/outputs.ts`; routes and descriptions are
attached to their procedures in `src/api/routers/`. Add both when introducing
an operation. `src/server/api.test.ts` checks the HTTP boundary, OpenAPI
coverage and interoperability with the browser RPC transport. Router tests
exercise the existing database behavior through oRPC's local client.

Implementation references: [oRPC HTTP handler](https://v1.orpc.dev/docs/openapi/openapi-handler),
[OpenAPI generation](https://v1.orpc.dev/docs/openapi/openapi-specification),
and [TanStack Query integration](https://v1.orpc.dev/docs/integrations/tanstack-query).
