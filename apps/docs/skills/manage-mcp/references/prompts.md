# Prompts — 1.0

## Create a prompt without arguments

```ts [server/mcp/prompts/plan-change.ts]
import { defineMcpPrompt } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpPrompt({
  description: 'Plan a careful project change',
  handler: () => 'Inspect the project, identify the affected behavior, then propose and verify the smallest useful change.',
})
```

There is no empty schema or schema-library import. The handler may receive the current MCP event as its first argument when it needs verified request context.

## Validate prompt arguments

```ts [server/mcp/prompts/review-code.ts]
import { z } from 'zod'
import { defineMcpPrompt } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpPrompt({
  description: 'Review code for correctness and maintainability',
  inputSchema: z.object({
    code: z.string().min(1).describe('Code to review'),
    focus: z.enum(['correctness', 'performance', 'security']).default('correctness'),
  }),
  handler: ({ code, focus }) => `Review this code for ${focus}:\n\n${code}`,
})
```

Use a complete schema rather than a raw Zod shape. Defaults are applied before the callback. Keep prompt arguments compatible with MCP's string-based argument transport.

## Name the prompt

Names and titles come from filenames unless explicitly set. A subdirectory supplies an inferred group. Duplicate advertised names within an endpoint fail validation.

A string is a user message. Return explicit messages for an assistant response or a multi-message conversation; the old `role` property is removed. See [arguments and message results](https://mcp-toolkit.nuxt.dev/prompts/input-handler-messages).

## Choose one argument contract

| Contract | Use |
| --- | --- |
| `inputSchema: z.object(...)` | Parse and infer arguments |
| `arguments: [...]` | Advertise arguments with completion callbacks |
| Neither | A prompt with no arguments |

With arguments, handlers receive `(args, event)`; without them, handlers receive `event`. The explicit argument-list form gives the handler a `Record<string, string>`. Validate values inside that callback.

## Complete an argument

```ts [server/mcp/prompts/language-guide.ts]
import { z } from 'zod'
import { defineMcpPrompt } from '@nuxtjs/mcp-toolkit/server'

const input = z.object({ language: z.enum(['typescript', 'javascript']) })

export default defineMcpPrompt({
  description: 'Explain conventions for a language',
  arguments: [{
    name: 'language',
    required: true,
    complete: ({ argument }) => ({
      values: ['typescript', 'javascript'].filter(value => value.startsWith(argument.value)),
    }),
  }],
  handler: (args) => {
    const { language } = input.parse(args)
    return `Explain the project conventions for ${language}.`
  },
})
```

Completion is a suggestion interface. A client can still send another value, so the handler validates the final arguments. The completion callback receives the current argument, previously resolved arguments, and the request event. Required scopes gate completion as well as prompt expansion.

## Return multiple messages

```ts [server/mcp/prompts/review-conversation.ts]
import { z } from 'zod'
import { defineMcpPrompt } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpPrompt({
  description: 'Prepare a focused code review conversation',
  inputSchema: z.object({ code: z.string() }),
  handler: ({ code }) => ({
    description: 'A correctness review',
    messages: [
      { role: 'assistant', content: { type: 'text', text: 'I will review correctness and explain concrete issues.' } },
      { role: 'user', content: { type: 'text', text: code } },
    ],
  }),
})
```

MCP prompt messages use user and assistant roles. Put reusable instructions into the message text; a prompt definition does not add a system-role shortcut. Resources may be embedded through the protocol's supported content shapes.

Prompts have no tool-style `isError` result. Throw an appropriate public error when expansion fails, and keep private diagnostics in your server logger.
