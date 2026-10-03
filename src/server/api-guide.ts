import { apiOperations, type ApiSpecification } from './api-operations'

export const apiGuide = (spec: ApiSpecification) => {
  const base = (spec.servers?.[0]?.url ?? '').replace(/\/+$/, '')
  const endpoints = apiOperations(spec)
    .map(
      ({ path, method, operation }) =>
        `${method.toUpperCase()} ${base}${path}${operation.operationId ? ` (${operation.operationId})` : ''}\n  ${operation.description ?? operation.summary ?? ''}`
    )
    .join('\n\n')

  return `# Tekne API

Plain JSON access to Tekne documents, tagged lines and structured data.
Fetch /api/openapi.json for full input, output and error schemas (OpenAPI 3.1).
Resolve relative URLs against this server's origin.

Use the app's trusted network, such as Tailscale. There is no separate API key
or per-user authorization; anyone who can reach the server can read and change
its data.

GET inputs use URL-encoded query parameters. Other inputs use JSON bodies with
Content-Type: application/json. Responses contain the result without an RPC
envelope. Dates are ISO 8601 strings.

Read before editing; preview bulk changes. Check both HTTP status and the
returned result. After an uncertain mutation, inspect state before retrying.

## Endpoint index

Generated from the running router's OpenAPI: methods, URLs, operation IDs and
descriptions. Use the schema above for required fields and response shapes.

${endpoints}
`
}
