import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db, schema } from 'hub:db'

export default defineMcpTool({
  name: 'update_todo',
  description: 'Update an existing todo (title and/or content)',
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  _meta: { inputExamples: [
    { id: 1, title: 'Updated title', content: 'New content' },
    { id: 2, title: 'Just rename this' },
  ] },
  inputSchema: z.object({
    id: z.number().describe('The ID of the todo to update'),
    title: z.string().optional().describe('New title for the todo'),
    content: z.string().optional().describe('New content/description for the todo'),
  }),
  handler: async ({ id, title, content }) => {
    const event = useEvent()
    const userId = event.context.userId as string

    const [existingTodo] = await db
      .select()
      .from(schema.todos)
      .where(and(eq(schema.todos.id, id), eq(schema.todos.userId, userId)))
      .limit(1)

    if (!existingTodo) {
      return `Todo with ID ${id} not found or you don't have permission to update it.`
    }

    const updateData: { title?: string, content?: string | null, updatedAt: Date } = {
      updatedAt: new Date(),
    }

    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content || null

    const updatedRows = await db.update(schema.todos)
      .set(updateData)
      .where(and(eq(schema.todos.id, id), eq(schema.todos.userId, userId)))
      .returning()

    const updated = updatedRows[0]
    if (!updated) {
      return `Todo with ID ${id} could not be updated.`
    }

    return updated
  },
})
