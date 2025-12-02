import { queryCollection } from '@nuxt/content/server'

export default defineMcpTool({
  description: 'Lists all documentation pages with titles, paths, and descriptions. ALWAYS call this first to discover available pages before using get-page, unless the user provides a specific path.',
  cache: '1h',
  handler: async () => {
    const event = useEvent()
    const siteUrl = import.meta.dev ? 'http://localhost:3000' : getRequestURL(event).origin

    try {
      const pages = await queryCollection(event, 'docs')
        .select('title', 'path', 'description')
        .all()

      const result = pages.map(page => ({
        title: page.title,
        path: page.path,
        description: page.description,
        url: `${siteUrl}${page.path}`,
      }))

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    }
    catch {
      return {
        content: [{ type: 'text', text: 'Failed to list pages' }],
        isError: true,
      }
    }
  },
})
