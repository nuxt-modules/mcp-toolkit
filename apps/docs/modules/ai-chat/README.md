# AI Chat Module

A Nuxt module that provides an AI-powered chat interface using MCP (Model Context Protocol) tools.

## Features

- AI chat slideover component with streaming responses
- MCP tools integration for documentation search
- Syntax highlighting for code blocks
- FAQ suggestions
- Persistent chat state

## Installation

1. Copy the `modules/ai-chat` folder to your Nuxt project
2. Install the required dependencies:

```bash
pnpm add @ai-sdk/mcp @ai-sdk/vue @ai-sdk/gateway ai motion-v shiki shiki-stream
```

3. Add the module to your `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['./modules/ai-chat'],

  aiChat: {
    apiPath: '/api/ai-chat',
    mcpPath: '/mcp',
    model: 'moonshotai/kimi-k2-turbo',
  }
})
```

## Usage

Add the components to your app:

```vue
<template>
  <div>
    <!-- Button to open the chat -->
    <AiChat tooltip-text="Ask AI a question" />

    <!-- Chat slideover (place once in your app/layout) -->
    <AiChatSlideover
      title="Ask AI"
      placeholder="Ask a question..."
      :faq-questions="faqQuestions"
    />
  </div>
</template>

<script setup>
const faqQuestions = [
  {
    category: 'Getting Started',
    items: ['How do I install?', 'How do I configure?'],
  },
  {
    category: 'Advanced',
    items: ['How do I customize?'],
  },
]
</script>
```

### Programmatic Control

Use the `useAIChat` composable to control the chat:

```vue
<script setup>
const { open, close, toggle, isOpen, messages, clearMessages } = useAIChat()

// Open chat with an initial message
open('How do I install the module?')

// Open and clear previous messages
open('New question', true)

// Toggle chat visibility
toggle()

// Clear all messages
clearMessages()
</script>
```

## Module Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiPath` | `string` | `/api/ai-chat` | API endpoint path for the chat |
| `mcpPath` | `string` | `/mcp` | MCP server path to connect to |
| `model` | `string` | `moonshotai/kimi-k2-turbo` | AI model identifier for AI SDK Gateway |

## Component Props

### `<AiChat>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tooltipText` | `string` | `Ask AI a question` | Tooltip text on hover |

### `<AiChatSlideover>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `Ask AI` | Title displayed in the header |
| `placeholder` | `string` | `Ask a question...` | Input placeholder text |
| `faqQuestions` | `FaqCategory[]` | `undefined` | FAQ categories to display when chat is empty |

#### FaqCategory Type

```ts
interface FaqCategory {
  category: string
  items: string[]
}
```

## Requirements

- Nuxt 4.x
- Nuxt UI 3.x (for `USlideover`, `UButton`, `UTextarea`, `UChatMessages`, etc.)
- An MCP server running (path configurable via `mcpPath`)
- AI SDK Gateway Key

## Components

- `AiChat` - Button to toggle the chat slideover
- `AiChatSlideover` - Main chat interface
- `AiChatToolCall` - Displays MCP tool invocations
- `AiChatPreStream` - Code block with streaming syntax highlighting

## Customization

### System Prompt

To customize the AI's behavior, edit the system prompt in:
`runtime/server/api/search.ts`

### Styling

The components use Nuxt UI and Tailwind CSS design tokens. Customize the appearance by modifying the component files or overriding the UI props.

## Dependencies

```json
{
  "@ai-sdk/mcp": "^0.0.8",
  "@ai-sdk/vue": "3.0.0-beta.105",
  "@ai-sdk/gateway": "^1.0.0",
  "ai": "6.0.0-beta.105",
  "motion-v": "^1.7.4",
  "shiki": "^3.0.0",
  "shiki-stream": "^0.1.2"
}
```
