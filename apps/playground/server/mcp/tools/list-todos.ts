import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'
import { db, schema } from 'hub:db'

export default defineMcpTool({
  name: 'list_todos',
  group: 'todos',
  tags: ['readonly'],
  description: 'List all todos for the authenticated user',
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  inputSchema: z.object({}),
  handler: async () => {
    const event = useEvent()
    const userId = event.context.userId as string

    const userTodos = await db
      .select()
      .from(schema.todos)
      .where(eq(schema.todos.userId, userId))
      .orderBy(desc(schema.todos.createdAt))

    if (userTodos.length === 0) {
      return []
    }

    return userTodos
  },
})
