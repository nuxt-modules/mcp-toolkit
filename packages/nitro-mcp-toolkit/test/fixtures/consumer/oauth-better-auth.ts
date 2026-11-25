import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { createMcpHandler, defineMcpServer, defineMcpTool } from 'nitro-mcp-toolkit'
import { betterAuth } from 'nitro-mcp-toolkit/oauth/better-auth'
import { createMcpTestClient, textOf } from 'nitro-mcp-toolkit/testing'

const resource = 'http://localhost/mcp'
const issuer = 'https://auth.example.com/api/auth'
const { privateKey, publicKey } = await generateKeyPair('ES256')
const key = { ...(await exportJWK(publicKey)), kid: 'better-auth-consumer', alg: 'ES256' }
const jwks = createServer((_request, response) => {
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify({ keys: [key] }))
})
jwks.listen(0, '127.0.0.1')
await once(jwks, 'listening')
const address = jwks.address()
assert(address && typeof address !== 'string')

function sign(claims: Record<string, unknown> = {}, typ = 'at+jwt') {
  return new SignJWT({
    iss: issuer,
    aud: resource,
    sub: 'member',
    azp: 'mcp-client',
    scope: 'account:read',
    exp: Math.floor(Date.now() / 1000) + 300,
    ...claims,
  })
    .setProtectedHeader({ alg: 'ES256', kid: key.kid, typ })
    .sign(privateKey)
}

try {
  const handler = createMcpHandler({
    ...defineMcpServer({
      oauth: betterAuth({
        resource: `${resource}/`,
        issuer,
        jwks: `http://127.0.0.1:${address.port}/jwks`,
        scopesSupported: ['account:read'],
      }),
      authorize: (identity) => identity.sub === 'member',
    }),
    tools: [
      defineMcpTool({
        name: 'account',
        scopes: ['account:read'],
        handler: (event) => {
          const sub = event.context.oauth?.sub
          assert(sub)
          return sub
        },
      }),
    ],
  })
  assert.deepEqual(handler.oauth?.metadata, {
    resource,
    authorization_servers: [issuer],
    bearer_methods_supported: ['header'],
    scopes_supported: ['account:read'],
  })
  const invalidTokens = [
    'opaque-session-token',
    await sign({}, 'JWT'),
    await sign({ aud: 'https://other.example.com/mcp' }),
    await sign({ iss: 'https://other.example.com/api/auth' }),
    await sign({ exp: undefined }),
    await sign({ exp: 1 }),
    await sign({ sub: undefined }),
    await sign({ cnf: { jkt: 'proof-key' } }),
    await sign({ cnf: { 'x5t#S256': 'certificate' } }),
  ]
  for (const era of ['modern', 'legacy'] as const) {
    await using client = await createMcpTestClient(handler, {
      era,
      headers: { authorization: `Bearer ${await sign()}` },
    })
    assert.equal(textOf(await client.callTool({ name: 'account' })), 'member')
    for (const token of invalidTokens) {
      await assert.rejects(
        createMcpTestClient(handler, { era, headers: { authorization: `Bearer ${token}` } }),
        /401|Unauthorized/,
      )
    }
    await assert.rejects(
      createMcpTestClient(handler, {
        era,
        headers: { authorization: `Bearer ${await sign({ sub: 'outsider' })}` },
      }),
      /403|Forbidden/,
    )
    assert.equal(textOf(await client.callTool({ name: 'account' })), 'member')
  }
  console.log(
    'Packed Better Auth subpath, prepared OAuth and authorization passed on both protocol eras.',
  )
} finally {
  jwks.closeAllConnections()
  await new Promise<void>((resolve, reject) =>
    jwks.close((error) => (error ? reject(error) : resolve())),
  )
}
