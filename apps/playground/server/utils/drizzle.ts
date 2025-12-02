export { sql, eq, and, or } from 'drizzle-orm'

export type Todo = typeof schema.todos.$inferSelect
export type User = typeof schema.user.$inferSelect
