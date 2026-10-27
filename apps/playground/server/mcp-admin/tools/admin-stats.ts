import { z } from 'zod'

export default defineMcpTool({
  name: 'admin_stats',
  title: 'Admin Stats',
  group: 'admin',
  tags: ['readonly', 'statistics'],
  description: 'View playground statistics including user count and todo count. Admin only.',
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  inputSchema: z.object({}),
  handler: async () => {
    const [users, todos] = await Promise.all([
      db.query.user.findMany(),
      db.query.todos.findMany(),
    ])

    return {
      users: users.length,
      todos: {
        total: todos.length,
        completed: todos.filter((t: { done: boolean }) => t.done).length,
        pending: todos.filter((t: { done: boolean }) => !t.done).length,
      },
    }
  },
})
