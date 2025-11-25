import { queryCollection } from '@nuxt/content/server'

export default defineCachedEventHandler(async (event) => {
  const siteUrl = import.meta.dev ? 'http://localhost:3000' : getRequestURL(event).origin

  try {
    const pages = await queryCollection(event, 'docs')
      .select('title', 'path', 'description')
      .all()

    return pages.map(page => ({
      title: page.title,
      path: page.path,
      description: page.description,
      url: `${siteUrl}${page.path}`,
    }))
  }
  catch {
    return {
      content: [
        { type: 'text', text: 'Failed to list pages' },
      ],
      isError: true,
    }
  }
}, {
  maxAge: 60 * 60,
  getKey: () => {
    return 'mcp-list-pages'
  },
})
