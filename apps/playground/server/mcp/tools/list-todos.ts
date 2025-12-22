export default defineMcpTool({
  name: 'list_todos',
  description: 'List all todos for the authenticated user',
  inputSchema: {},
  handler: async () => {
    const event = useEvent()
    const userId = event.context.userId as string

    const userTodos = await db.query.todos.findMany({
      where: (todos, { eq }) => eq(todos.userId, userId),
      orderBy: (todos, { desc }) => desc(todos.createdAt),
    })

    if (userTodos.length === 0) {
      return jsonResult([])
    }

    return jsonResult(userTodos)
  },
})
