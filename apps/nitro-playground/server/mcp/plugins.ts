import { defineMcpPlugins } from 'nitro-mcp-toolkit'

/**
 * Exercises the `plugins.ts` convention. A real app installs the engine's own
 * kit here (`mcpTasks()` from `h3-mcp/tasks`); this one advertises a settings
 * object instead, so the inspector shows it under `capabilities.extensions` on
 * `initialize` without the playground taking a second dependency.
 */
export default defineMcpPlugins([
  {
    id: 'playground/stamp',
    settings: () => ({ servedBy: 'nitro-mcp-playground' }),
  },
])
