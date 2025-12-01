import type { H3Event } from 'h3'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
// To run `auth:schema` command, you need to import the schema from the .nuxt/hub/database/schema.js file
// import { db, schema } from '../../.nuxt/hub/db.mjs'
// But in dev & prod, use 'hub:db' to import the schema
import { db, schema } from 'hub:db'

export const auth: ReturnType<typeof betterAuth> = betterAuth({
  database: drizzleAdapter(
    db,
    {
      provider: 'pg',
      schema,
    },
  ),
  baseURL: getBaseURL(),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  account: {
    accountLinking: {
      enabled: true,
    },
  },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
})

function getBaseURL() {
  let baseURL = process.env.BETTER_AUTH_URL
  if (!baseURL) {
    try {
      baseURL = getRequestURL(useEvent()).origin
    }
    catch { /* empty */ }
  }
  return baseURL
}

export async function requireUser(event: H3Event) {
  const session = await auth.api.getSession({
    headers: event.headers,
  })

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  return session
}
