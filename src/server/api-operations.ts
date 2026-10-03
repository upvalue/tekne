type Operation = {
  operationId?: string
  summary?: string
  description?: string
}

export type ApiSpecification = {
  servers?: { url: string }[]
  paths?: Record<string, unknown>
}

const methods = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
])

// Path items may also contain parameters, servers, summaries and extensions.
// Only HTTP operations belong in either endpoint reference.
export const apiOperations = (spec: ApiSpecification) =>
  Object.entries(spec.paths ?? {}).flatMap(([path, item]) =>
    Object.entries(item as Record<string, Operation>)
      .filter(([method]) => methods.has(method))
      .map(([method, operation]) => ({ path, method, operation }))
  )
