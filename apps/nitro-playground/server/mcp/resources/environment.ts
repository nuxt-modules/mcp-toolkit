import { defineMcpResource } from 'nitro-mcp-toolkit'

export default defineMcpResource({
  uri: 'nitro://server/environment',
  description: 'Current environment information (safe subset)',
  handler: async () => {
    const safeEnv = {
      NODE_ENV: process.env.NODE_ENV || 'development',
      TZ: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone,
    }

    return {
      contents: [{
        uri: 'nitro://server/environment',
        mimeType: 'application/json',
        text: JSON.stringify(safeEnv, null, 2),
      }],
    }
  },
})
