import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db, schema } from 'hub:db'

export default defineMcpTool({
  name: 'delete_todo',
  group: 'todos',
  tags: ['destructive'],
  description: 'Delete a todo',
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  inputSchema: z.object({
    id: z.number().describe('The ID of the todo to delete'),
  }),
  handler: async ({ id }) => {
    const event = useEvent()
    const userId = event.context.userId as string

    const [existingTodo] = await db
      .select()
      .from(schema.todos)
      .where(and(eq(schema.todos.id, id), eq(schema.todos.userId, userId)))
      .limit(1)

    if (!existingTodo) {
      return `Todo with ID ${id} not found or you don't have permission to delete it.`
    }

    await db.delete(schema.todos)
      .where(and(eq(schema.todos.id, id), eq(schema.todos.userId, userId)))

    return `Todo "${existingTodo.title}" has been deleted.`
  },
})
