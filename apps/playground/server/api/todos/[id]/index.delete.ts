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

  const deletedTodo = await db
    .delete(todos)
    .where(
      and(
        eq(todos.id, id),
        eq(todos.userId, user.id),
      ),
    )
    .returning()

  if (!deletedTodo.length) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Todo not found or access denied',
    })
  }

  return { success: true }
})
