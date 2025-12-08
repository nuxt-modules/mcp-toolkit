<script setup lang="ts">
const route = useRoute()

const pageUrl = route.path
const { open } = useAIChat()

const faqQuestions = [
  {
    category: 'Getting Started',
    items: [
      'What is Nuxt MCP Toolkit?',
      'How do I install the module?',
      'How do I use the DevTools?',
    ],
  },
  {
    category: 'Core Features',
    items: [
      'How do I create a new MCP Tool?',
      'How do I add an MCP Resource?',
      'How do I configure Prompts?',
    ],
  },
  {
    category: 'Advanced',
    items: [
      'Can I expose my API routes as MCP Tools?',
      'Does it support TypeScript?',
      'How do I add a custom MCP server?',
    ],
  },
]
</script>

<template>
  <div>
    <UButton
      icon="i-lucide-brain"
      target="_blank"
      label="Explain with AI"
      size="sm"
      variant="ghost"
      color="neutral"
      @click="open(`Explain the page ${pageUrl}`, true)"
    />
    <AiChatSlideover :faq-questions="faqQuestions" />
  </div>
</template>
