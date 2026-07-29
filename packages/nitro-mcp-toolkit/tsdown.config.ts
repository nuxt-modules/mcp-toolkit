import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'runtime/handler': 'src/runtime/handler.ts',
  },
  format: 'esm',
  dts: true,
  clean: true,
  deps: {
    neverBundle: [
      'nitro',
      'nitro/types',
      'h3',
      '@modelcontextprotocol/server',
      'zod',
    ],
  },
})
