import { z } from 'zod'
import { queryCollection } from '@nuxt/content/server'

export default defineMcpTool({
  description: 'Retrieves the full markdown content of a documentation page. Use this after list-pages to read specific pages, or directly if the user provides a path.',
  inputSchema: {
    path: z.string().describe('The page path from list-pages or provided by the user (e.g., /getting-started/installation)'),
  },
  cache: '1h',
  handler: async ({ path }) => {
    const event = useEvent()
    const siteUrl = import.meta.dev ? 'http://localhost:3000' : 'https://mcp-toolkit.nuxt.dev'

    try {
      const page = await queryCollection(event, 'docs')
        .where('path', '=', path)
        .select('title', 'path', 'description')
        .first()

      if (!page) {
        return {
          content: [{ type: 'text', text: 'Page not found' }],
          isError: true,
        }
      }

      const content = await $fetch<string>(`/raw${path}.md`, {
        baseURL: siteUrl,
      })

      const result = {
        title: page.title,
        path: page.path,
        description: page.description,
        content,
        url: `${siteUrl}${page.path}`,
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    }
    catch {
      return {
        content: [{ type: 'text', text: 'Failed to get page' }],
        isError: true,
      }
    }
  },
})
