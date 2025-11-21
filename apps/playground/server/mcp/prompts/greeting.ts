export default defineMcpPrompt({
  name: 'greeting',
  title: 'Greeting',
  description: 'Generate a personalized greeting message',
  handler: async () => {
    const hour = new Date().getHours()
    const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'

    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Good ${timeOfDay}! How can I help you today?`,
        },
      }],
    }
  },
})
