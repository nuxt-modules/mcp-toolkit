# Prompts — 1.0

## Author prompts

```ts
import { z } from 'zod'

export default defineMcpPrompt({
  inputSchema: z.object({ language: z.string() }),
  handler: ({ language }, event) => `Review this ${language} change.`,
})
```

A callback with a schema receives `(args, event)`. A callback without arguments receives the event. Names and titles are inferred from the filename.

MCP messages use `user` and `assistant` roles. Express operational guidance in message text; a `system` role is not part of the prompt message schema.

## Inputs and messages

```ts
export default defineMcpPrompt({
  handler: () => ({
    messages: [{
      role: 'assistant',
      content: { type: 'text', text: 'I will review the change.' },
    }],
  }),
})
```

The old `role` shorthand is removed. A string always becomes one user message. Explicit results can contain several messages and the content blocks supported by the protocol.

Exceptions become JSON-RPC errors. Prompt callbacks should fetch only the application data the current request is authorized to access.

## Prompt completion

```ts
const languages = ['typescript', 'javascript', 'python']

export default defineMcpPrompt({
  arguments: [{
    name: 'language',
    required: true,
    complete: context => ({ values: languages.filter(value => value.startsWith(context.argument.value)) }),
  }],
  handler: ({ language }) => `Review this ${language} change.`,
})
```

Use `arguments` instead of `inputSchema` for callbacks with per-argument completion. The old SDK `completable()` helper is removed.

A prompt's `scopes` protect completion callbacks as well as expansion. Its static metadata remains visible in `prompts/list`.
