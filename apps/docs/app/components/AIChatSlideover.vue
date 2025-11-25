<script setup lang="ts">
import type { DefineComponent } from 'vue'
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport } from 'ai'
import ProseStreamPre from './prose/PreStream.vue'

const components = {
  pre: ProseStreamPre as unknown as DefineComponent,
}

const { isOpen, messages, pendingMessage, clearPending } = useAIChat()

const input = ref('')

watch(pendingMessage, (message) => {
  if (message) {
    if (messages.value.length === 0 && chat.messages.length > 0) {
      // Clear chat messages by setting the internal array
      chat.messages.length = 0
    }
    chat.sendMessage({
      text: message,
    })
    clearPending()
  }
}, { immediate: true })

watch(messages, (newMessages) => {
  if (newMessages.length === 0 && chat.messages.length > 0) {
    chat.messages.length = 0
  }
}, { deep: true })

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

const toast = useToast()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getToolLabel(toolName: string, args: any) {
  const path = args?.path || ''

  const labels: Record<string, string> = {
    'list-pages': 'Listed documentation pages',
    'list_pages': 'Listed documentation pages',
    'get-page': `Read ${path}`,
    'get_page': `Read ${path}`,
  }

  return labels[toolName] || toolName
}

const chat = new Chat({
  messages: messages.value,
  transport: new DefaultChatTransport({
    api: '/api/search',
  }),
  onError: (error: Error) => {
    const { message } = typeof error.message === 'string' && error.message[0] === '{' ? JSON.parse(error.message) : error

    toast.add({
      description: message,
      icon: 'i-lucide-alert-circle',
      color: 'error',
      duration: 0,
    })
  },
  onFinish: () => {
    messages.value = chat.messages
  },
})

function handleSubmit(event?: Event) {
  event?.preventDefault()

  if (!input.value.trim()) {
    return
  }

  chat.sendMessage({
    text: input.value,
  })

  input.value = ''
}

function askQuestion(question: string) {
  chat.sendMessage({
    text: question,
  })
}

onMounted(() => {
  if (pendingMessage.value) {
    chat.sendMessage({
      text: pendingMessage.value,
    })
    clearPending()
  }
  else if (chat.lastMessage?.role === 'user') {
    chat.regenerate()
  }
})
</script>

<template>
  <USlideover
    v-model:open="isOpen"
    side="right"
    :ui="{
      overlay: 'bg-default/60 backdrop-blur-sm',
      content: 'w-full sm:max-w-md bg-default/95 backdrop-blur-xl shadow-2xl',
      header: 'px-3! py-2! border-b border-muted/50',
      body: 'p-0!',
      footer: 'p-0!',
    }"
  >
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <div class="size-6 rounded-full bg-primary/10 flex items-center justify-center">
            <UIcon
              name="i-lucide-sparkles"
              class="size-3.5 text-primary"
            />
          </div>
          <span class="font-medium text-highlighted">Ask AI</span>
        </div>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          class="text-muted hover:text-highlighted"
          @click="isOpen = false"
        />
      </div>
    </template>

    <template #body>
      <UChatMessages
        v-if="chat.messages.length > 0"
        should-auto-scroll
        :messages="chat.messages"
        compact
        :status="chat.status"
        :user="{ ui: { content: 'text-sm' } }"
        :ui="{ indicator: '*:bg-accented' }"
        class="flex-1 px-4 py-4"
      >
        <template #content="{ message }">
          <div class="flex flex-col gap-2">
            <template
              v-for="(part, index) in message.parts"
              :key="`${message.id}-${part.type}-${index}${'state' in part ? `-${part.state}` : ''}`"
            >
              <MDCCached
                v-if="part.type === 'text'"
                :value="part.text"
                :cache-key="`${message.id}-${index}`"
                :components="components"
                :parser-options="{ highlight: false }"
                class="*:first:mt-0 *:last:mb-0"
              />

              <ChatToolCall
                v-else-if="part.type === 'tool-invocation' || part.type === 'dynamic-tool'"
                :text="getToolLabel((part as any).toolName, (part as any).args || (part as any).input)"
                :is-loading="(part as any).state !== 'output-available'"
              />
            </template>
          </div>
        </template>
      </UChatMessages>

      <div
        v-else
        class="flex-1 overflow-y-auto px-4 py-4"
      >
        <p class="text-sm font-medium text-muted mb-4">
          FAQ
        </p>

        <div class="flex flex-col gap-5">
          <div
            v-for="category in faqQuestions"
            :key="category.category"
            class="flex flex-col gap-1.5"
          >
            <h4 class="text-xs font-medium text-dimmed uppercase tracking-wide">
              {{ category.category }}
            </h4>
            <div class="flex flex-col">
              <button
                v-for="question in category.items"
                :key="question"
                class="text-left text-sm text-muted hover:text-highlighted py-1.5 transition-colors"
                @click="askQuestion(question)"
              >
                {{ question }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="border-t border-muted/50 p-3 w-full">
        <div class="relative flex items-end gap-2 rounded-xl bg-elevated/70 pr-2 pb-2">
          <UTextarea
            v-model="input"
            :rows="1"
            autoresize
            variant="none"
            placeholder="Ask me a question about Nuxt MCP..."
            class="flex-1 text-sm bg-transparent resize-none"
            :ui="{
              base: 'bg-transparent! ring-0! shadow-none!',
            }"
            @keydown.enter.exact.prevent="handleSubmit"
          />
          <UButton
            icon="i-lucide-arrow-up"
            color="primary"
            size="xs"
            :disabled="!input.trim() || chat.status === 'streaming'"
            :loading="chat.status === 'streaming'"
            class="shrink-0 rounded-lg"
            @click="handleSubmit"
          />
        </div>
        <div class="flex justify-between items-center mt-2 px-1 text-xs text-dimmed">
          <span>Chat is cleared on refresh</span>
          <div class="flex items-center gap-1">
            <span>Line break</span>
            <UKbd value="shift" />
            <UKbd value="enter" />
          </div>
        </div>
      </div>
    </template>
  </USlideover>
</template>
