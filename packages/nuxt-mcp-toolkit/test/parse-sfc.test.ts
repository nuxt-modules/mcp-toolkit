import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  absolutiseRelativeImports,
  extractMcpAppStaticFields,
  parseSfcApp,
  walkTopLevelObjectFields,
} from '../src/setup/mcp-apps/parse-sfc'

describe('absolutiseRelativeImports', () => {
  // Regression for "Could not resolve './stay-finder.data' from
  // .nuxt/mcp-apps/gen/stay-finder.app.ts": SFCs co-locating helpers next to
  // themselves must keep working after the macro is emitted to the gen dir.
  it('rewrites ./ and ../ specifiers to absolute paths anchored at the SFC dir', () => {
    const out = absolutiseRelativeImports(
      [
        `import { generateStays } from './stay-finder.data'`,
        `import { shared } from "../shared/utils"`,
      ],
      '/abs/app/mcp',
    )
    expect(out[0]).toBe(`import { generateStays } from '/abs/app/mcp/stay-finder.data'`)
    expect(out[1]).toBe(`import { shared } from "/abs/app/shared/utils"`)
  })

  it('leaves bare specifiers untouched (zod, node:path, @scope/pkg, …)', () => {
    const out = absolutiseRelativeImports(
      [
        `import { z } from 'zod'`,
        `import { resolve } from 'node:path'`,
        `import { Foo } from '@nuxtjs/mcp-toolkit/server'`,
      ],
      '/abs/app/mcp',
    )
    expect(out).toEqual([
      `import { z } from 'zod'`,
      `import { resolve } from 'node:path'`,
      `import { Foo } from '@nuxtjs/mcp-toolkit/server'`,
    ])
  })
})

describe('parseSfcApp', () => {
  it('rejects SFCs with multiple defineMcpApp calls', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcp-app-'))
    try {
      const file = join(dir, 'double.vue')
      await writeFile(file, `<script setup lang="ts">
defineMcpApp({ description: 'first' })
defineMcpApp({ description: 'second' })
</script>
<template><div /></template>
`, 'utf-8')

      await expect(parseSfcApp(file)).rejects.toThrow(/Multiple defineMcpApp\(\) calls/)
    }
    finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('extracts attachTo / group / tags from the macro', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcp-app-'))
    try {
      const file = join(dir, 'finder.vue')
      await writeFile(file, `<script setup lang="ts">
defineMcpApp({
  description: 'A finder',
  attachTo: 'finder',
  group: 'stays',
  tags: ['searchable', 'demo'],
})
</script>
<template><div /></template>
`, 'utf-8')

      const parsed = await parseSfcApp(file)
      expect(parsed.staticFields).toEqual({
        attachTo: 'finder',
        group: 'stays',
        tags: ['searchable', 'demo'],
      })
    }
    finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('throws when attachTo is a dynamic expression', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcp-app-'))
    try {
      const file = join(dir, 'dynamic.vue')
      await writeFile(file, `<script setup lang="ts">
const target = 'finder'
defineMcpApp({ attachTo: target })
</script>
<template><div /></template>
`, 'utf-8')

      await expect(parseSfcApp(file)).rejects.toThrow(/attachTo: … .* must be a string literal/)
    }
    finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('walkTopLevelObjectFields', () => {
  it('returns top-level entries only, skipping nested braces and strings', () => {
    const fields = walkTopLevelObjectFields(`{
      name: 'foo',
      _meta: { handler: 'inner' },
      tags: ['a', 'b'],
      handler: () => 'noop',
    }`)
    expect(fields.map(f => f.key)).toEqual(['name', '_meta', 'tags', 'handler'])
    expect(fields[3]?.valueText).toBe('() => \'noop\'')
  })

  it('handles single-line comments and string literals containing commas', () => {
    const fields = walkTopLevelObjectFields(`{
      // a comment
      desc: 'hello, world',
      group: "stays",
    }`)
    expect(fields).toEqual([
      { key: 'desc', valueText: '\'hello, world\'' },
      { key: 'group', valueText: '"stays"' },
    ])
  })

  it('returns [] for non-object inputs (defensive)', () => {
    expect(walkTopLevelObjectFields('undefined')).toEqual([])
    expect(walkTopLevelObjectFields('someExpr()')).toEqual([])
  })
})

describe('extractMcpAppStaticFields', () => {
  it('returns empty object when none of the routing fields are present', () => {
    expect(extractMcpAppStaticFields(`{ description: 'foo' }`)).toEqual({})
  })

  it('extracts string literals (single + double quotes)', () => {
    expect(extractMcpAppStaticFields(`{ attachTo: 'finder', group: "stays" }`)).toEqual({
      attachTo: 'finder',
      group: 'stays',
    })
  })

  it('strips trailing TypeScript assertions', () => {
    expect(extractMcpAppStaticFields(`{ attachTo: 'finder' as const }`)).toEqual({
      attachTo: 'finder',
    })
  })

  it('extracts string array literals for tags', () => {
    expect(extractMcpAppStaticFields(`{ tags: ['searchable', "demo"] }`)).toEqual({
      tags: ['searchable', 'demo'],
    })
  })

  it('throws on dynamic attachTo (variable reference)', () => {
    expect(() => extractMcpAppStaticFields(`{ attachTo: someVar }`))
      .toThrow(/attachTo: ….*must be a string literal/)
  })

  it('throws on dynamic group (template literal)', () => {
    expect(() => extractMcpAppStaticFields(`{ group: \`stays-\${id}\` }`))
      .toThrow(/group: ….*must be a string literal/)
  })

  it('throws on tags that contain non-literal entries', () => {
    expect(() => extractMcpAppStaticFields(`{ tags: ['ok', someTag] }`))
      .toThrow(/tags: ….*must be an array of string literals/)
  })

  it('ignores routing fields nested inside _meta (only top-level matters)', () => {
    expect(extractMcpAppStaticFields(`{ _meta: { attachTo: 'finder' } }`)).toEqual({})
  })
})
