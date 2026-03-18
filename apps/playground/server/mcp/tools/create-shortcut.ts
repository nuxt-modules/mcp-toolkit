import { z } from 'zod'

export default defineMcpTool({
  name: 'create_shortcut',
  title: 'Create Shortcut',
  description: 'Create a shortcut tool that wraps a todo search query. The new tool will appear in the tool list immediately.',
  inputSchema: {
    name: z.string().describe('Name for the shortcut (e.g. "my_todos")'),
    status: z.enum(['all', 'completed', 'pending']).describe('Filter todos by status'),
  },
  enabled: event => event.context.role === 'admin',
  handler: async ({ name, status }) => {
    const mcp = useMcpServer()

    mcp.registerTool(name, {
      description: `Shortcut: list ${status} todos`,
      annotations: { readOnlyHint: true, destructiveHint: false },
    }, async () => {
      const allTodos = await db.query.todos.findMany()
      const filtered = status === 'all'
        ? allTodos
        : allTodos.filter((t: { done: boolean }) =>
            status === 'completed' ? t.done : !t.done,
          )
      return jsonResult(filtered)
    })

    return textResult(`Shortcut "${name}" created — it now appears in your tool list.`)
  },
})
