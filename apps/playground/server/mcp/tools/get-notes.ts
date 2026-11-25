export default defineMcpTool({
  name: 'get_notes',
  description: 'Read the authenticated user’s saved notes.',
  annotations: { readOnlyHint: true },
  handler: async (event) => {
    const userId = event.context.userId
    if (typeof userId !== 'string') throw new Error('Authentication required.')
    return await useStorage().getItem<string[]>(`notes:${encodeURIComponent(userId)}`) ?? []
  },
})
