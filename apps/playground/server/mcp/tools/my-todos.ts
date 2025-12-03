import type { Session, User } from 'better-auth'

interface McpContext {
  session: Session
  user: User
}

export default defineMcpTool({
  description: 'Get the authenticated user\'s todo list',
  handler: async () => {
    const { user } = requireMcpContext<McpContext>()

    const userTodos = await db.query.todos.findMany({
      where: (todos, { eq }) => eq(todos.userId, user.id),
      orderBy: (todos, { desc }) => desc(todos.createdAt),
    })

    if (userTodos.length === 0) {
      return textResult(`Hello ${user.name || user.email}! You don't have any todos yet.`)
    }

    const todoList = userTodos.map((todo, index) => {
      const status = todo.done ? '✅' : '⬜'
      return `${index + 1}. ${status} ${todo.title}${todo.content ? ` - ${todo.content}` : ''}`
    }).join('\n')

    return textResult(`Hello ${user.name || user.email}! Here are your todos:\n\n${todoList}`)
  },
})
