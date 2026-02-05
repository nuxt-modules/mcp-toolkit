import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    { input: 'src/module', name: 'module' },
    { input: 'src/definitions/index', name: 'definitions/index' },
    { input: 'src/handler', name: 'handler' },
    { input: 'src/providers/node', name: 'providers/node' },
    { input: 'src/providers/cloudflare', name: 'providers/cloudflare' },
  ],
  declaration: true,
  clean: true,
  failOnWarn: false,
  rollup: {
    emitCJS: false,
  },
  externals: [
    'nitropack',
    'nitropack/runtime',
    'h3',
    'zod',
    'agents',
    'agents/mcp',
    '@modelcontextprotocol/sdk',
    '@modelcontextprotocol/sdk/server/mcp.js',
    '@modelcontextprotocol/sdk/server/streamableHttp.js',
    '@modelcontextprotocol/sdk/types.js',
    '@modelcontextprotocol/sdk/shared/protocol.js',
    '@modelcontextprotocol/sdk/server/zod-compat.js',
    // Virtual modules
    /^#mcp\//,
  ],
})
