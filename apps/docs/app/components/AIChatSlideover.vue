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
const toolCalls = ref<Record<string, any[]>>({})

const lastMessage = computed(() => chat.messages.at(-1))
const showThinking = computed(() =>
  chat.status === 'streaming'
  && lastMessage.value?.role === 'assistant'
  && lastMessage.value?.parts?.length === 0,
)

watch(pendingMessage, (message) => {
  if (message) {
    chat.sendMessage({
      text: message,
    })
    clearPending()
  }
}, { immediate: true })

const faqQuestions = [
  {
    category: 'Getting Started',
    items: [
      'How do I install and create a new Nuxt project?',
      'What are the differences between Nuxt 3 and Nuxt 2?',
      'What is the project structure in Nuxt?',
    ],
  },
  {
    category: 'Core Concepts',
    items: [
      'What is SSR and how does it work in Nuxt?',
      'What is the difference between SSR, SSG, and SPA in Nuxt?',
      'How does file-based routing work?',
      'How do auto-imports work in Nuxt?',
    ],
  },
  {
    category: 'Data Fetching',
    items: [
      'What is the difference between useFetch and useAsyncData?',
      'How do I fetch data on the server side?',
      'How do I handle loading and error states?',
    ],
  },
  {
    category: 'Advanced',
    items: [
      'How do I create and use Nuxt modules?',
      'How do I create API routes with server routes?',
      'How do I deploy my Nuxt application?',
      'How do I optimize performance in Nuxt?',
    ],
  },
]

const toast = useToast()

function getAgentCalls(message: any) {
  if (showThinking.value && message.role === 'assistant') {
    return [{ type: 'thinking', state: 'calling' }]
  }

  return message.parts
    .filter((p: any) => p.type === 'tool-nuxt-agent' || p.type === 'tool-nuxt-ui-agent')
    .map((p: any) => ({
      type: p.type === 'tool-nuxt-agent' ? 'nuxt' : 'nuxt-ui',
      state: p.state === 'output-available' ? 'done' : 'calling',
    }))
}

const chat = new Chat({
  messages: messages.value,
  transport: new DefaultChatTransport({
    api: '/api/search',
  }),
  onData: (data) => {
    console.log('data', data)
  },
  onError: (error) => {
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

function handleSubmit(event: Event) {
  event.preventDefault()

  if (!input.value.trim()) {
    return
  }

  toolCalls.value = {}

  chat.sendMessage({
    text: input.value,
  })

  input.value = ''
}

function askQuestion(question: string) {
  toolCalls.value = {}

  chat.sendMessage({
    text: question,
  })
}

onMounted(() => {
  if (pendingMessage.value) {
    toolCalls.value = {}
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
    title="Ask AI"
    side="right"
    :ui="{
      header: 'px-4!',
      content: 'w-full sm:max-w-md',
      body: 'py-4! px-2!',
      footer: 'p-0!',
    }"
  >
    <template #body>
      {{ toolCalls }}
      <UChatMessages
        v-if="chat.messages.length > 0"
        should-auto-scroll
        :messages="chat.messages"
        compact
        :status="chat.status"
        :user="{ ui: { content: 'text-sm' } }"
        :ui="{ indicator: '*:bg-accented' }"
        class="flex-1"
      >
        <template #content="{ message }">
          <div class="*:first:mt-0! *:last:mb-0! flex flex-col gap-3">
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
            </template>
          </div>
        </template>
      </UChatMessages>

      <div
        v-else
        class="flex flex-col gap-6 px-4 py-2"
      >
        <h3 class="text-sm font-medium text-muted">
          FAQ
        </h3>

        <div class="flex flex-col gap-6">
          <div
            v-for="category in faqQuestions"
            :key="category.category"
            class="flex flex-col gap-2"
          >
            <h4 class="text-xs font-medium text-muted uppercase tracking-wide mb-1">
              {{ category.category }}
            </h4>
            <div class="flex flex-col gap-1">
              <UButton
                v-for="question in category.items"
                :key="question"
                :label="question"
                color="neutral"
                variant="ghost"
                size="sm"
                block
                class="justify-start text-left h-auto py-2 whitespace-normal"
                @click="askQuestion(question)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex flex-col w-full">
        <UChatPrompt
          v-model="input"
          variant="naked"
          :error="chat.error"
          placeholder="Ask me anything about Nuxt MCP Toolkit..."
          :ui="{ trailing: 'items-center' }"
          :maxrows="5"
          :rows="2"
          @submit="handleSubmit"
        >
          <template #footer>
            <div class="flex justify-between items-center px-2 w-full">
              <!-- <UButton
                label="Deep thinking"
                size="xs"
                color="neutral"
                variant="soft"
                icon="i-lucide-lightbulb"
              /> -->
              <div />
              <UChatPromptSubmit
                color="neutral"
                size="xs"
                :status="chat.status"
                class="rounded-full"
              />
            </div>
          </template>
        </UChatPrompt>
        <div class="flex justify-end items-center gap-2 text-xs text-muted p-2 border-t border-default">
          Chat is cleared on refresh
          <USeparator
            orientation="vertical"
            class="h-4"
          />
          <span>Line break</span>
          <div class="flex items-center gap-1">
            <UKbd value="shift" />
            <UKbd value="enter" />
          </div>
        </div>
      </div>
    </template>
  </USlideover>
</template>
