import { expect, test } from 'vitest'
import { apiGuide } from './api-guide'
import { apiOperations } from './api-operations'
import { apiReference } from './api-reference'

test('both references index HTTP operations, not path metadata', () => {
  const spec = {
    servers: [{ url: '/api/v1' }],
    paths: {
      '/example': {
        summary: 'Path summary',
        description: 'Path description',
        parameters: [{ name: 'filter', in: 'query' }],
        servers: [{ url: '/api/v1' }],
        $ref: '#/components/pathItems/Example',
        'x-internal': { description: 'Extension' },
        get: {
          operationId: 'readExample',
          summary: 'Read example',
          description: 'Read without writing.',
          responses: { '200': { description: 'Example response' } },
        },
        post: { summary: 'Write example' },
      },
    },
  }

  expect(apiOperations(spec).map(({ method }) => method)).toEqual([
    'get',
    'post',
  ])
  const guide = apiGuide(spec)
  const index = guide.split('## Endpoint index')[1]
  expect(index).toContain('GET /api/v1/example (readExample)')
  expect(index).toContain('Read without writing.')
  expect(index).toContain('POST /api/v1/example\n  Write example')
  expect(index).not.toContain('Path summary')
  expect(index).not.toContain('Path description')
  expect(index).not.toContain('Extension')
  expect(index).not.toContain('Example response')

  const reference = apiReference(spec)
  expect(reference.match(/<section /g)).toHaveLength(2)
  expect(reference).toContain('GET /api/v1/example')
  expect(reference).toContain('POST /api/v1/example')
  expect(reference).toContain('Example response')
  expect(reference).not.toContain('PARAMETERS /api/v1/example')
})

test('references tolerate an empty specification and preserve HTML escaping', () => {
  expect(apiOperations({})).toEqual([])
  expect(apiGuide({})).toContain('/api/openapi.json')
  expect(apiReference({})).toContain('/api/llms.txt')
  const reference = apiReference({
    paths: { '/<example>': { get: { description: '<script>"&</script>' } } },
  })
  expect(reference).toContain('/api/v1/&lt;example&gt;')
  expect(reference).toContain('&lt;script&gt;&quot;&amp;&lt;/script&gt;')
  expect(reference).not.toContain('<script>')
})

test('guide derives endpoint URLs from the specification server', () => {
  const paths = { '/example': { get: { summary: 'Read example' } } }
  expect(apiGuide({ paths, servers: [{ url: '/api/v2/' }] })).toContain(
    'GET /api/v2/example'
  )
  expect(apiGuide({ paths })).toContain('GET /example')
  expect(apiGuide({ paths })).not.toContain('/api/v1')
})
