export default eventHandler(async (event) => {
  const { user } = await requireUser(event)
  const { title, content } = await readBody(event)

  const todo = await db.insert(schema.todos).values({
    title,
    content: content || null,
    userId: user.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning()

  return todo[0]
})
