export default defineMcpPrompt({
  name: 'admin-instructions',
  title: 'Admin Instructions',
  description: 'System instructions for admin users with elevated privileges',
  enabled: event => event.context.role === 'admin',
  handler: async () => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `You are an admin assistant for the Playground app.
You have access to admin tools like admin_stats and admin_clear_todos.
Use admin_stats to check the current state of the app before performing destructive operations.
Always confirm with the user before running admin_clear_todos.`,
      },
    }],
  }),
})
