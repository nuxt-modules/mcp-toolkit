import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Variables } from '@modelcontextprotocol/sdk/shared/uriTemplate.js'

export default defineMcpResource({
  name: 'file',
  title: 'File Resource',
  uri: new ResourceTemplate('file:///project/{path}', {
    list: async () => {
      try {
        const projectRoot = process.cwd()
        const files: Array<{ uri: string, name: string }> = []

        async function scanDir(dir: string, basePath: string = '') {
          const entries = await readdir(dir, { withFileTypes: true })
          for (const entry of entries) {
            const fullPath = join(dir, entry.name)
            const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name

            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
              await scanDir(fullPath, relativePath)
            }
            else if (entry.isFile() && !entry.name.startsWith('.')) {
              files.push({
                uri: `file:///project/${relativePath}`,
                name: relativePath,
              })
            }
          }
        }

        await scanDir(projectRoot)

        return {
          resources: files.slice(0, 20),
        }
      }
      catch {
        return {
          resources: [],
        }
      }
    },
  }),
  handler: async (uri: URL, variables: Variables) => {
    try {
      const path = variables.path as string
      const filePath = join(process.cwd(), path)
      const content = await readFile(filePath, 'utf-8')

      const mimeType = path.endsWith('.md')
        ? 'text/markdown'
        : path.endsWith('.ts') || path.endsWith('.js')
          ? 'text/typescript'
          : path.endsWith('.json')
            ? 'application/json'
            : 'text/plain'

      return {
        contents: [{
          uri: uri.toString(),
          mimeType,
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
