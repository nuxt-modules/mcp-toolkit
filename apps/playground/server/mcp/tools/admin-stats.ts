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
  enabled: event => event.context.role === 'admin',
  inputSchema: {},
  handler: async () => {
    const [users, todos] = await Promise.all([
      db.query.user.findMany(),
      db.query.todos.findMany(),
    ])

    return jsonResult({
      users: users.length,
      todos: {
        total: todos.length,
        completed: todos.filter((t: { completed: boolean }) => t.completed).length,
        pending: todos.filter((t: { completed: boolean }) => !t.completed).length,
      },
    })
  },
})
