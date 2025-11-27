export default eventHandler(async (event) => {
  const { user } = await requireUser(event)

  const userTodos = await db.query.todos.findMany({
    where: (todos, { eq }) => eq(todos.userId, user.id),
    orderBy: (todos, { desc }) => desc(todos.createdAt),
  })

  return userTodos
})
