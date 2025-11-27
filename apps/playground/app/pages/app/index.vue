<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

interface Todo {
  id: number
  title: string
  content: string | null
  done: boolean
  createdAt: string
  updatedAt: string
}

const { data: todos, refresh } = await useFetch<Todo[]>('/api/todos')
const toast = useToast()

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().optional(),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  title: undefined,
  content: undefined,
})

const deleteTodo = async (id: number) => {
  await $fetch(`/api/todos/${id}`, {
    method: 'DELETE',
  })
  toast.add({
    icon: 'i-lucide-trash',
    title: 'Todo deleted',
    color: 'success',
  })
  refresh()
}

const toggleTodo = async (id: number) => {
  await $fetch(`/api/todos/${id}/toggle`, {
    method: 'PATCH',
  })
  refresh()
}

async function createTodo(event: FormSubmitEvent<Schema>) {
  await $fetch('/api/todos', {
    method: 'POST',
    body: {
      title: event.data.title,
      content: event.data.content || null,
    },
  })
  toast.add({
    icon: 'i-lucide-plus',
    title: 'Todo created',
    color: 'success',
  })
  refresh()
  state.title = undefined
  state.content = undefined
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">
      My Todos
    </h1>

    <UCard class="mb-8">
      <template #header>
        <h2 class="text-lg font-semibold">
          Create a new todo
        </h2>
      </template>

      <UForm
        :schema
        :state
        class="flex flex-col gap-4"
        @submit="createTodo"
      >
        <UFormField
          label="Title"
          name="title"
          required
        >
          <UInput
            v-model="state.title"
            placeholder="What do you need to do?"
          />
        </UFormField>
        <UFormField
          label="Description"
          name="content"
        >
          <UTextarea
            v-model="state.content"
            placeholder="Add some details (optional)"
            :rows="2"
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          label="Add Todo"
          icon="i-lucide-plus"
          block
        />
      </UForm>
    </UCard>

    <div class="space-y-3">
      <div
        v-if="!todos || todos.length === 0"
        class="text-center py-12 text-muted"
      >
        <UIcon
          name="i-lucide-check-square"
          class="size-12 mx-auto mb-4 opacity-50"
        />
        <p>No todos yet. Create your first one above!</p>
      </div>

      <UCard
        v-for="todo in todos"
        :key="todo.id"
        class="transition-all hover:shadow-md"
        :class="{ 'opacity-60': todo.done }"
      >
        <div class="flex items-start gap-4">
          <UCheckbox
            :model-value="todo.done"
            @update:model-value="toggleTodo(todo.id)"
          />

          <div class="flex-1 min-w-0">
            <h3
              class="font-medium"
              :class="{ 'line-through text-muted': todo.done }"
            >
              {{ todo.title }}
            </h3>
            <p
              v-if="todo.content"
              class="text-sm text-muted mt-1"
            >
              {{ todo.content }}
            </p>
            <p class="text-xs text-dimmed mt-2">
              {{ formatDate(todo.createdAt) }}
            </p>
          </div>

          <UButton
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            size="xs"
            @click="deleteTodo(todo.id)"
          />
        </div>
      </UCard>
    </div>
  </div>
</template>
