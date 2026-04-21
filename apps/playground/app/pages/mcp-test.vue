<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

useSeoMeta({
  title: 'MCP Test Console',
  description: 'Interactively test elicitation features against the playground MCP server.',
})

const tester = useMcpTester()
const formAnswers = ref<Record<string, unknown>>({})
const toolArgs = ref<Record<string, Record<string, unknown>>>({})

const featuredToolNames = ['release_channel', 'connect_account']

const featuredTools = computed(() => {
  return featuredToolNames
    .map(name => tester.tools.value.find(t => t.name === name))
    .filter(Boolean) as typeof tester.tools.value
})

const otherTools = computed(() => {
  return tester.tools.value.filter(t => !featuredToolNames.includes(t.name))
})

const elicitationOptions = [
  { label: 'Form mode (default)', value: 'form' },
  { label: 'Form + URL mode', value: 'form+url' },
  { label: 'Disabled (refuse all)', value: 'none' },
] as const

const statusColor = computed(() => {
  return tester.status.value === 'connected'
    ? 'success'
    : tester.status.value === 'connecting'
      ? 'info'
      : tester.status.value === 'error' ? 'error' : 'neutral'
})

interface InputField {
  key: string
  type: string
  enum?: string[]
  description?: string
  default?: unknown
  required: boolean
}

function getInputFields(tool: { inputSchema?: Record<string, unknown> } | undefined): InputField[] {
  if (!tool?.inputSchema) return []
  const schema = tool.inputSchema as { properties?: Record<string, Record<string, unknown>>, required?: string[] }
  const props = schema.properties ?? {}
  return Object.entries(props).map(([key, prop]) => ({
    key,
    type: String(prop.type ?? 'string'),
    enum: Array.isArray(prop.enum) ? prop.enum as string[] : undefined,
    description: prop.description as string | undefined,
    default: prop.default,
    required: schema.required?.includes(key) ?? false,
  }))
}

function getArgs(toolName: string) {
  if (!toolArgs.value[toolName]) toolArgs.value[toolName] = {}
  return toolArgs.value[toolName]!
}

async function runTool(toolName: string) {
  const raw = toolArgs.value[toolName] ?? {}
  const tool = tester.tools.value.find(t => t.name === toolName)
  const args: Record<string, unknown> = {}
  for (const field of getInputFields(tool)) {
    let value = raw[field.key]
    if (value === '' || value === undefined) {
      if (field.default !== undefined) value = field.default
      else continue
    }
    if (field.type === 'number' && typeof value === 'string') value = Number(value)
    if (field.type === 'boolean' && typeof value === 'string') value = value === 'true'
    args[field.key] = value
  }
  await tester.callTool(toolName, args)
}

watch(() => tester.pendingElicit.value, (next) => {
  if (next?.mode === 'form' && next.requestedSchema) {
    const initial: Record<string, unknown> = {}
    for (const [key, prop] of Object.entries(next.requestedSchema.properties)) {
      if (prop.default !== undefined) initial[key] = prop.default
      else if (prop.type === 'boolean') initial[key] = false
      else if (prop.type === 'string') initial[key] = ''
    }
    formAnswers.value = initial
  }
  else {
    formAnswers.value = {}
  }
})

function formatResult(entry: typeof tester.toolCalls.value[number]) {
  if (entry.error) return entry.error
  const result = entry.result as { content?: Array<{ type: string, text?: string }> } | undefined
  const text = result?.content?.find(c => c.type === 'text')?.text
  if (text) return text
  return JSON.stringify(entry.result, null, 2)
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString()
}

onMounted(() => {
  tester.connect()
})

onBeforeUnmount(() => {
  tester.disconnect()
})
</script>

<template>
  <UApp>
    <div class="min-h-dvh bg-default">
      <header class="sticky top-0 z-50 border-b border-default bg-elevated/80 backdrop-blur">
        <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div class="flex items-center gap-2">
            <UIcon
              name="i-lucide-flask-conical"
              class="size-5 text-primary"
            />
            <h1 class="text-lg font-semibold">
              MCP Test Console
            </h1>
            <UBadge
              :color="statusColor"
              variant="subtle"
              size="sm"
            >
              {{ tester.status.value }}
            </UBadge>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              variant="ghost"
              color="neutral"
              icon="i-lucide-rotate-ccw"
              size="sm"
              :loading="tester.status.value === 'connecting'"
              @click="tester.connect()"
            >
              Reconnect
            </UButton>
            <UButton
              to="/app"
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-lucide-arrow-left"
            >
              Back to app
            </UButton>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
        <UAlert
          v-if="tester.errorMessage.value"
          color="error"
          variant="subtle"
          icon="i-lucide-octagon-alert"
          :title="tester.errorMessage.value"
        />

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-4">
              <h2 class="font-semibold">
                Connection
              </h2>
              <span
                v-if="tester.sessionId.value"
                class="text-xs font-mono text-muted truncate max-w-xs"
                :title="tester.sessionId.value"
              >
                session: {{ tester.sessionId.value }}
              </span>
            </div>
          </template>

          <UFormField
            label="Elicitation capability"
            hint="Switch to test how tools react when the client supports different modes."
          >
            <USelect
              :model-value="tester.options.value.elicitation"
              :items="[...elicitationOptions]"
              class="w-full sm:max-w-sm"
              @update:model-value="(value: string) => tester.connect({ elicitation: value as 'none' | 'form' | 'form+url' })"
            />
          </UFormField>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="font-semibold">
              Featured demo tools
            </h2>
          </template>

          <div class="grid gap-4 lg:grid-cols-2">
            <UCard
              v-for="tool in featuredTools"
              :key="tool.name"
              variant="subtle"
            >
              <div class="flex flex-col gap-3">
                <div>
                  <div class="font-mono text-sm font-semibold">
                    {{ tool.name }}
                  </div>
                  <p class="mt-1 text-sm text-muted">
                    {{ tool.description }}
                  </p>
                </div>

                <div
                  v-for="field in getInputFields(tool)"
                  :key="field.key"
                  class="flex flex-col gap-1"
                >
                  <label class="text-xs font-medium text-muted">{{ field.key }}<span
                    v-if="field.required"
                    class="text-error"
                  >*</span></label>
                  <USelect
                    v-if="field.enum"
                    :model-value="getArgs(tool.name)[field.key] as string"
                    :items="field.enum.map(v => ({ label: v, value: v }))"
                    :placeholder="field.description ?? ''"
                    class="w-full"
                    @update:model-value="(v: string) => getArgs(tool.name)[field.key] = v"
                  />
                  <UCheckbox
                    v-else-if="field.type === 'boolean'"
                    :model-value="!!getArgs(tool.name)[field.key]"
                    :label="field.description ?? field.key"
                    @update:model-value="(v: boolean | 'indeterminate') => getArgs(tool.name)[field.key] = v === true"
                  />
                  <UInput
                    v-else
                    :model-value="getArgs(tool.name)[field.key] as string"
                    :type="field.type === 'number' ? 'number' : 'text'"
                    :placeholder="field.description ?? ''"
                    class="w-full"
                    @update:model-value="(v: string | number) => getArgs(tool.name)[field.key] = v"
                  />
                </div>

                <UButton
                  block
                  icon="i-lucide-play"
                  :disabled="tester.status.value !== 'connected'"
                  @click="runTool(tool.name)"
                >
                  Run
                </UButton>
              </div>
            </UCard>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="font-semibold">
                Tool calls
              </h2>
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-trash-2"
                @click="tester.clearCalls()"
              >
                Clear
              </UButton>
            </div>
          </template>
          <div
            v-if="tester.toolCalls.value.length === 0"
            class="py-8 text-center text-sm text-muted"
          >
            No calls yet. Pick a tool above and hit Run.
          </div>
          <ul class="space-y-3">
            <li
              v-for="entry in tester.toolCalls.value"
              :key="entry.id"
              class="rounded-md border border-default bg-elevated/40 p-3"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="font-mono text-xs font-semibold">{{ entry.tool }}</span>
                <span class="text-[10px] uppercase text-dimmed">{{ formatTime(entry.startedAt) }}</span>
              </div>
              <pre
                v-if="Object.keys(entry.args).length"
                class="mt-2 overflow-x-auto rounded bg-default/60 p-2 text-[11px]"
              >{{ JSON.stringify(entry.args) }}</pre>
              <div
                v-if="entry.finishedAt"
                class="mt-2 whitespace-pre-wrap rounded text-xs"
                :class="entry.error ? 'text-error' : 'text-default'"
              >
                {{ formatResult(entry) }}
              </div>
              <UBadge
                v-else
                color="warning"
                variant="subtle"
                size="xs"
                icon="i-lucide-loader"
                class="mt-2"
              >
                pending
              </UBadge>
            </li>
          </ul>
        </UCard>

        <UCard v-if="otherTools.length">
          <template #header>
            <h2 class="font-semibold">
              All other tools
              <span class="text-xs font-normal text-muted">({{ otherTools.length }})</span>
            </h2>
          </template>
          <div class="flex flex-wrap gap-2">
            <UBadge
              v-for="tool in otherTools"
              :key="tool.name"
              variant="subtle"
              color="neutral"
              :title="tool.description"
            >
              {{ tool.name }}
            </UBadge>
          </div>
        </UCard>
      </main>

      <UModal
        :open="!!tester.pendingElicit.value"
        :dismissible="false"
        :ui="{ content: 'sm:max-w-lg' }"
      >
        <template #content>
          <div
            v-if="tester.pendingElicit.value"
            class="flex flex-col gap-5 p-5 sm:p-6"
          >
            <div class="flex items-center gap-2">
              <UIcon
                :name="tester.pendingElicit.value.mode === 'url' ? 'i-lucide-external-link' : 'i-lucide-message-square-quote'"
                class="size-5 text-primary"
              />
              <h3 class="font-semibold">
                {{ tester.pendingElicit.value.mode === 'url' ? 'URL elicitation' : 'Form elicitation' }}
              </h3>
            </div>

            <p class="text-sm text-default">
              {{ tester.pendingElicit.value.message }}
            </p>

            <div
              v-if="tester.pendingElicit.value.mode === 'url'"
              class="rounded-md border border-default bg-elevated/40 p-3 text-sm"
            >
              <div class="text-xs uppercase tracking-wide text-dimmed">
                URL
              </div>
              <a
                class="mt-1 block break-all font-mono text-primary hover:underline"
                target="_blank"
                rel="noopener"
                :href="tester.pendingElicit.value.url"
              >{{ tester.pendingElicit.value.url }}</a>
            </div>

            <form
              v-else-if="tester.pendingElicit.value.requestedSchema"
              class="flex flex-col gap-4"
            >
              <UFormField
                v-for="(prop, key) in tester.pendingElicit.value.requestedSchema.properties"
                :key="key"
                :label="(prop.title as string) ?? key"
                :hint="(prop.description as string) ?? ''"
                :required="tester.pendingElicit.value.requestedSchema.required?.includes(key) ?? false"
              >
                <USelect
                  v-if="Array.isArray(prop.enum)"
                  :model-value="formAnswers[key] as string"
                  :items="(prop.enum as string[]).map(v => ({ label: v, value: v }))"
                  class="w-full"
                  @update:model-value="(v: string) => formAnswers[key] = v"
                />
                <UCheckbox
                  v-else-if="prop.type === 'boolean'"
                  :model-value="!!formAnswers[key]"
                  @update:model-value="(v: boolean | 'indeterminate') => formAnswers[key] = v === true"
                />
                <UInput
                  v-else
                  :model-value="formAnswers[key] as string"
                  :type="prop.type === 'number' || prop.type === 'integer' ? 'number' : 'text'"
                  class="w-full"
                  @update:model-value="(v: string | number) => formAnswers[key] = v"
                />
              </UFormField>
            </form>

            <div class="flex flex-wrap justify-end gap-2 border-t border-default pt-4">
              <UButton
                color="neutral"
                variant="ghost"
                @click="tester.answerElicit({ action: 'cancel' })"
              >
                Cancel
              </UButton>
              <UButton
                color="neutral"
                variant="subtle"
                @click="tester.answerElicit({ action: 'decline' })"
              >
                Decline
              </UButton>
              <UButton
                color="primary"
                @click="tester.answerElicit({
                  action: 'accept',
                  content: tester.pendingElicit.value.mode === 'form' ? formAnswers : undefined,
                })"
              >
                Accept
              </UButton>
            </div>
          </div>
        </template>
      </UModal>
    </div>
  </UApp>
</template>
