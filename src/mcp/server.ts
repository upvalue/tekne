import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { instructions } from './instructions'
import { registerTools, type TekneApi } from './tools'

export function createTekneMcpServer(api: TekneApi) {
  const server = new McpServer(
    { name: 'tekne', version: '1.0.0' },
    { instructions }
  )
  registerTools(server, api)
  return server
}
