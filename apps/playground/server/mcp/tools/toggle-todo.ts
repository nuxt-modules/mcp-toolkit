import { z } from 'zod'
import { eq, and } from 'drizzle-orm'

export default defineMcpTool({
  name: 'toggle_todo',
  description: 'Toggle a todo between done and not done',
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  inputSchema: {
    id: z.number().describe('The ID of the todo to toggle'),
  },
  handler: async ({ id }) => {
    const event = useEvent()
    const userId = event.context.userId as string

    const existingTodo = await db.query.todos.findFirst({
      where: (todos, { eq: e, and: a }) => a(e(todos.id, id), e(todos.userId, userId)),
    })

    if (!existingTodo) {
      return textResult(`Todo with ID ${id} not found or you don't have permission to update it.`)
    }

    const [updated] = await db.update(schema.todos)
      .set({
        done: !existingTodo.done,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.todos.id, id), eq(schema.todos.userId, userId)))
      .returning()

    return jsonResult(updated)
  },
})
