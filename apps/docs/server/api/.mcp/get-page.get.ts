import { z } from 'zod'
import { queryCollection } from '@nuxt/content/server'

const querySchema = z.object({
  path: z.string().describe('The page path (e.g., /getting-started/installation)'),
})

export default defineCachedEventHandler(async (event) => {
  const { path } = await getValidatedQuery(event, querySchema.parse)

  const siteUrl = import.meta.dev ? 'http://localhost:3000' : 'https://mcp-toolkit.nuxt.dev'

  try {
    const page = await queryCollection(event, 'docs')
      .where('path', '=', path)
      .select('title', 'path', 'description')
      .first()

    if (!page) {
      return {
        content: [
          {
            type: 'text',
            text: 'Page not found',
          },
        ],
        isError: true,
      }
    }

    const content = await $fetch<string>(`/raw${path}.md`, {
      baseURL: siteUrl,
    })

    return {
      title: page.title,
      path: page.path,
      description: page.description,
      content,
      url: `${siteUrl}${page.path}`,
    }
  }
  catch {
    return {
      content: [
        {
          type: 'text',
          text: 'Failed to get page',
        },
      ],
      isError: true,
    }
  }
}, {
  maxAge: 60 * 60,
  getKey: (event) => {
    const query = getQuery(event)
    return `mcp-get-page-${query.path}`
  },
})
