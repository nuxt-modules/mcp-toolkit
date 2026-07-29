import { defineBuildConfig } from 'obuild/config'

export default defineBuildConfig({
  entries: [
    {
      type: 'bundle',
      input: ['./src/index.ts', './src/runtime/handler.ts'],
      rolldown: {
        external: ['nitro', 'nitro/types', 'h3', '@modelcontextprotocol/server', 'zod'],
      },
    },
  ],
})
