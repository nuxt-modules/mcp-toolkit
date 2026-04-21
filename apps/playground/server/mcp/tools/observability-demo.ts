import { z } from 'zod'

export default defineMcpTool({
  name: 'observability_demo',
  description: 'Demo logger: stream notifications to the client AND tag the server-side wide event',
  inputSchema: {
    label: z.string().describe('Label to attach to the server-side wide event'),
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  handler: async ({ label }) => {
    const log = useMcpLogger('demo')

    // → MCP CLIENT: shows up in the Inspector "Server Notifications" panel
    //   (and the AI client's log viewer). Honours `logging/setLevel`.
    await log.notify.info({ msg: 'observability_demo started', label })
    await log.notify.warning({ msg: 'this is a sample warning' })

    // → SERVER TERMINAL: merged into the request's evlog wide event and
    //   pretty-printed once the response is sent. Drains pick this up too.
    log.set({ demo: { label } })
    log.event('work_done', { duration: 42 })

    return `Sent 2 client notifications and tagged the wide event with label "${label}". Check your dev terminal for the merged wide event.`
  },
})
