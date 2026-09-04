import { defineMcpTool } from 'nitro-mcp-toolkit'

/**
 * Exercises `scopes`, including the two parts of the contract that surprise
 * people: this endpoint has no OAuth, so the guard fails closed and every call
 * is refused — and the tool is still in `tools/list` regardless, carrying its
 * scopes in `_meta`, because options resolve before a request is authenticated.
 */
export default defineMcpTool({
  description: 'Refuses unless the access token carries todos:write',
  scopes: ['todos:write'],
  handler: () => 'never reached on an endpoint without oauth',
})
