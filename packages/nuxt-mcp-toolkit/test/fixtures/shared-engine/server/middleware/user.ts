import { defineEventHandler } from 'nuxt/server'
import { contexts } from '../utils/contexts'

export default defineEventHandler((event) => {
  contexts.add(event.context)
  event.context.user = event.req.headers.get('x-test-user') ?? 'demo-user'
  event.res.headers.set('x-middleware', 'preserved')
})
