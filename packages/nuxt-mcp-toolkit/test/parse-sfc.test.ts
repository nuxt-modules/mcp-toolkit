import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { absolutiseRelativeImports, parseSfcApp } from '../src/setup/mcp-apps/parse-sfc'

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
})
