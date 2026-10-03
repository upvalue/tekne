import { apiOperations, type ApiSpecification } from './api-operations'

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!
  )

export const apiReference = (spec: ApiSpecification) => {
  const operations = apiOperations(spec)
    .map(
      ({ path, method, operation }) => `
      <section id="${escapeHtml(method + path)}">
        <h2><code>${escapeHtml(method.toUpperCase() + ' /api/v1' + path)}</code></h2>
        <p>${escapeHtml(operation.description ?? operation.summary ?? '')}</p>
        <details><summary>Request and response schemas</summary><pre>${escapeHtml(JSON.stringify(operation, null, 2))}</pre></details>
      </section>`
    )
    .join('')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tekne API</title><link rel="alternate" type="text/plain" href="/api/llms.txt" title="Tekne API agent guide"><style>
body{font:16px/1.6 system-ui,sans-serif;max-width:960px;margin:48px auto;padding:0 24px;color:#202020}
pre{background:#f4f4f5;padding:16px;overflow:auto}code{font-size:.9em}section{border-top:1px solid #ddd;margin-top:32px}a{color:#3158aa}summary{cursor:pointer}
</style></head><body>
<h1>Tekne API</h1>
<p>For agents and command-line clients: <a href="/api/llms.txt">read the plaintext API guide</a> (also available at <a href="/llms.txt">/llms.txt</a>).</p>
<p>Base URL: <code>/api/v1</code>. <a href="/api/openapi.json">Download the OpenAPI 3.1 specification</a> for client generation or import it into an API explorer.</p>
<p>Use the same host and trusted network as the app. Tekne has no separate API token or per-user authorization. Anyone with access to this server can read and change its data.</p>
<p>Requests and responses use plain JSON. GET inputs use query parameters; POST, PUT and DELETE inputs use JSON bodies. Set <code>Content-Type: application/json</code>. The body limit is 10 MiB. Dates use ISO 8601 strings. Document names go in parameters or JSON so spaces and slashes work without path encoding. Creation and deletion retain the app's name rules: ASCII letters, digits and supported punctuation; $ may appear only at the beginning of template names.</p>
<h2>Try it with curl</h2>
<p>Set BASE to your Tekne host. These examples create, read, search and delete a scratch document.</p>
<pre>BASE=http://localhost:3005
curl -sS -X POST "$BASE/api/v1/documents" \\
  -H 'Content-Type: application/json' -d '{"name":"API scratch"}'
curl -sS -G "$BASE/api/v1/documents/content" --data-urlencode 'name=API scratch'
curl -sS -G "$BASE/api/v1/documents" --data-urlencode 'query=scratch'
curl -sS -X POST "$BASE/api/v1/search/lines" \\
  -H 'Content-Type: application/json' -d '{"operators":[{"type":"doc","value":"API scratch"}],"limit":10}'
curl -sS -X DELETE "$BASE/api/v1/documents" \\
  -H 'Content-Type: application/json' -d '{"name":"API scratch"}'</pre>
<h2>Update a document safely</h2>
<p>Read <code>/documents/content?name=...</code>, edit its <code>doc</code>, then PUT <code>{"name":"...","doc":{...},"expectedRevision":0}</code> to the same path, using the revision from the read. The complete document replaces the old one and derived search/tag data is rebuilt. Omitting expectedRevision performs an unconditional upsert.</p>
<p>A successful save returns <code>{"status":"ok","revision":1}</code>. A stale revision returns HTTP 200 with <code>{"status":"conflict","serverDoc":{...},"serverRevision":1}</code> and makes no change. Reload and reconcile the document before retrying.</p>
<p>Current documents use <code>{"type":"doc","schemaVersion":1,"children":[...]}</code>. Each line requires <code>type:"line"</code>, <code>mdContent</code>, numeric <code>indent</code>, and ISO UTC <code>timeCreated</code>/<code>timeUpdated</code>. Optional fields include <code>collapsed</code>, <code>datumTimeSeconds</code>, <code>datumTaskStatus</code> (complete, incomplete, unset), <code>datumPinnedAt</code>, and <code>color</code>. Reads preserve legacy document fields; maintenance validation reports how to migrate them.</p>
<h2>Search operators</h2>
<p>Send an operators array. Supported types are <code>tag</code> (value includes #, prefix match), <code>doc</code> (title glob), <code>from</code>/<code>to</code> (ISO date; to includes the entire day), <code>age</code> (days), <code>status</code> (complete, incomplete, unset), <code>has</code> (timer, task, pin), and <code>text</code> (value plus wildcard: none, prefix, suffix, exact). An empty array matches all non-template lines. The aggregate endpoint supports tag, doc, from, to and age only.</p>
<p>Line search returns <code>items</code> and an optional <code>nextCursor</code>. Send that number as <code>cursor</code> with the same filters for the next page. Pagination uses offsets; edits between requests can change page boundaries.</p>
<h2>Errors and bulk changes</h2>
<p>Errors use HTTP status codes and <code>{"defined":true,"code":"NOT_FOUND","status":404,"message":"..."}</code>. Validation errors are 400; missing resources are 404; duplicate names and stale bulk revisions are 409; unexpected failures are 500. Validation errors may include <code>data.issues</code>. Check the status and code; the message is for people. Document save conflicts use the HTTP 200 result described above.</p>
<p>Preview endpoints do not write. For stale-task cancellation, select preview documents and send their titles and revisions as <code>documents:[{"title":"...","expectedRevision":0}]</code> with the same cutoff. The execute operation is transactional. Tag and document rename previews are advisory; execution recomputes the affected data. Maintenance operations affect all documents and should be called deliberately.</p>
<h2>Endpoints</h2>${operations}
</body></html>`
}
