import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defineBuildConfig } from 'obuild/config'

const AMBIENT = 'virtual.d.ts'
const REFERENCE = `/// <reference path="./${AMBIENT}" />`

export default defineBuildConfig({
  entries: [
    {
      type: 'bundle',
      input: ['./src/runtime/index.ts', './src/module/index.ts', './src/testing/index.ts'],
      rolldown: {
        // Left unbundled so obuild's dts pass resolves these against the
        // consumer's own copies rather than inlining ours.
        external: [
          'nitro',
          'nitro/types',
          'h3',
          'h3-mcp',
          'pathe',
          'tinyglobby',
          '@modelcontextprotocol/client',
        ],
      },
    },
  ],
  hooks: {
    // The dts pass drops triple-slash references, so the declaration of the
    // modules `mcp()` generates has to be re-attached here. Without it, a
    // consumer's `import mcp from '#mcp/mcp/handler'` still resolves at runtime
    // and reads as an unresolved module in an editor.
    async end({ pkgDir }) {
      const types = join(pkgDir, 'dist/runtime/index.d.mts')
      const source = await readFile(join(pkgDir, 'src/runtime', AMBIENT), 'utf8')

      await writeFile(
        join(pkgDir, 'dist/runtime', AMBIENT),
        source.replace('./index.ts', './index.mjs'),
      )

      const emitted = await readFile(types, 'utf8')

      if (!emitted.includes(REFERENCE)) {
        await writeFile(types, `${REFERENCE}\n${emitted}`)
      }
    },
  },
})
