import { defineBuildConfig } from 'obuild/config'

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
          'tinyglobby',
          '@modelcontextprotocol/server',
          '@modelcontextprotocol/client',
        ],
      },
    },
  ],
})
