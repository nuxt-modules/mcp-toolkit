import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export default defineMcpResource({
  name: 'project-readme',
  uri: 'file:///project/README.md',
  metadata: {
    description: 'Project README file',
    mimeType: 'text/markdown',
    annotations: {
      audience: ['user'],
      priority: 0.8,
      lastModified: new Date().toISOString(),
    },
  },
  handler: async (uri: URL) => {
    try {
      const filePath = fileURLToPath(uri)
      const content = await readFile(filePath, 'utf-8')
      return {
        contents: [{
          uri: uri.toString(),
          mimeType: 'text/markdown',
          text: content,
        }],
      }
    }
    catch (error) {
      return {
        contents: [{
          uri: uri.toString(),
          mimeType: 'text/plain',
          text: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      }
    }
  },
})
