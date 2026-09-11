import { defineMcpPlugins } from 'nitro-mcp-toolkit'

// Advertised under `capabilities.extensions`, which is what lets the e2e run
// prove the built app installed the plugin rather than only importing it.
export default defineMcpPlugins([
  {
    id: 'fixture/stamp',
    settings: () => ({ stamped: true }),
  },
])
