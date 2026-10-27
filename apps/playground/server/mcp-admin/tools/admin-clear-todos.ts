import { z } from 'zod'

export default defineMcpTool({
  name: 'admin_clear_todos',
  title: 'Admin Clear Todos',
  group: 'admin',
  tags: ['destructive'],
  description: 'Delete all todos across all users. Admin only.',
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  inputSchema: z.object({}),
  handler: async () => {
    const allTodos = await db.query.todos.findMany()
    if (allTodos.length === 0) {
      return 'No todos to delete.'
    }

    await db.delete(schema.todos)
    return `Deleted ${allTodos.length} todos.`
  },
})
