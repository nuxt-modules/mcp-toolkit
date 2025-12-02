import { pgTable, text, timestamp, boolean, bigint } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { user } from './auth'

export const todos = pgTable('todos', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  title: text('title').notNull(),
  content: text('content'),
  done: boolean('done').notNull().default(false),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const todosRelations = relations(todos, ({ one }) => ({
  user: one(user, {
    fields: [todos.userId],
    references: [user.id],
  }),
}))
