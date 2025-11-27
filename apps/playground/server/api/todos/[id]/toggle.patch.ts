export default eventHandler(async (event) => {
  const { user } = await requireUser(event)
  const id = parseInt(getRouterParam(event, 'id') as string)

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid todo ID',
    })
  }

  const { todos } = schema

  const existingTodo = await db.query.todos.findFirst({
    where: (todos, { eq, and }) => and(
      eq(todos.id, id),
      eq(todos.userId, user.id),
    ),
  })

  if (!existingTodo) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Todo not found or access denied',
    })
  }

  const updatedTodo = await db
    .update(todos)
    .set({
      done: !existingTodo.done,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(todos.id, id),
        eq(todos.userId, user.id),
      ),
    )
    .returning()

  return updatedTodo[0]
})
