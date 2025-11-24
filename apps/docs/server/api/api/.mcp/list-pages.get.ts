import { queryCollection } from '@nuxt/content/server'

export default defineCachedEventHandler(async (event) => {
  const siteUrl = import.meta.dev ? 'http://localhost:3000' : getRequestURL(event).origin

  const pages = await queryCollection(event, 'docs')
    .select('title', 'path', 'description')
    .all()
  console.log('pages', pages)

  return pages.map(page => ({
    title: page.title,
    path: page.path,
    description: page.description,
    url: `${siteUrl}${page.path}`,
  }))
}, {
  maxAge: 60 * 60,
  getKey: () => {
    return 'mcp-list-pages'
  },
})
