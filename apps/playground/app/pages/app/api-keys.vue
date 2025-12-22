<script setup lang="ts">
interface ApiKey {
  id: string
  name: string | null
  start: string | null
  createdAt: Date | string
  lastRequest: Date | string | null
  expiresAt: Date | string | null
  enabled: boolean
}

const { client } = useAuth()
const toast = useToast()
const url = useRequestURL()

const apiKeys = ref<ApiKey[]>([])
const loading = ref(true)
const creating = ref(false)
const newKeyValue = ref<string | null>(null)
const showNewKeyModal = ref(false)

async function fetchApiKeys() {
  loading.value = true
  try {
    const { data } = await client.apiKey.list()
    apiKeys.value = data || []
  }
  catch (error) {
    console.error('Error fetching API keys:', error)
    toast.add({
      icon: 'i-lucide-alert-circle',
      title: 'Failed to fetch API keys',
      color: 'error',
    })
  }
  finally {
    loading.value = false
  }
}

async function quickCreateApiKey() {
  creating.value = true
  try {
    const name = `MCP Key ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    const { data, error } = await client.apiKey.create({ name })

    if (error) {
      toast.add({
        icon: 'i-lucide-alert-circle',
        title: error.message || 'Failed to create API key',
        color: 'error',
      })
      return
    }

    if (data?.key) {
      newKeyValue.value = data.key
      showNewKeyModal.value = true
      await fetchApiKeys()
    }
  }
  catch (error) {
    console.error('Error creating API key:', error)
    toast.add({
      icon: 'i-lucide-alert-circle',
      title: 'Failed to create API key',
      color: 'error',
    })
  }
  finally {
    creating.value = false
  }
}

async function deleteApiKey(id: string) {
  try {
    await client.apiKey.delete({ keyId: id })
    toast.add({
      icon: 'i-lucide-trash',
      title: 'API key deleted',
      color: 'success',
    })
    await fetchApiKeys()
  }
  catch (error) {
    console.error('Error deleting API key:', error)
    toast.add({
      icon: 'i-lucide-alert-circle',
      title: 'Failed to delete API key',
      color: 'error',
    })
  }
}

function formatDate(date: Date | string | null) {
  if (!date) return 'Never'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  toast.add({
    icon: 'i-lucide-copy',
    title: 'Copied to clipboard',
    color: 'success',
  })
}

const mcpConfigWithKey = computed(() => {
  const key = newKeyValue.value || 'YOUR_API_KEY'
  return JSON.stringify({
    mcpServers: {
      'playground-todos': {
        url: `${url.origin}/mcp`,
        headers: {
          Authorization: `Bearer ${key}`,
        },
      },
    },
  }, null, 2)
})

onMounted(() => {
  fetchApiKeys()
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">
        API Keys
      </h1>
      <UButton
        icon="i-lucide-plus"
        label="Create Key"
        :loading="creating"
        @click="quickCreateApiKey"
      />
    </div>

    <div
      v-if="loading"
      class="text-center py-12 text-muted"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="size-12 mx-auto mb-4 animate-spin"
      />
      <p>Loading API keys...</p>
    </div>

    <template v-else>
      <div
        v-if="apiKeys.length === 0"
        class="text-center py-12 text-muted"
      >
        <UIcon
          name="i-lucide-key"
          class="size-12 mx-auto mb-4 opacity-50"
        />
        <p class="mb-4">
          No API keys yet
        </p>
        <UButton
          icon="i-lucide-plus"
          label="Create your first key"
          :loading="creating"
          @click="quickCreateApiKey"
        />
      </div>

      <div
        v-else
        class="space-y-3"
      >
        <UCard
          v-for="key in apiKeys"
          :key="key.id"
          :class="{ 'opacity-60': !key.enabled }"
        >
          <div class="flex items-center gap-4">
            <UIcon
              name="i-lucide-key"
              class="size-5 text-muted shrink-0"
            />

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium truncate">{{ key.name || 'Unnamed Key' }}</span>
                <code class="text-xs text-muted font-mono">{{ key.start }}••••</code>
              </div>
              <div class="text-xs text-dimmed mt-1">
                Created {{ formatDate(key.createdAt) }}
                <span v-if="key.lastRequest"> · Last used {{ formatDate(key.lastRequest) }}</span>
              </div>
            </div>

            <UButton
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              size="xs"
              @click="deleteApiKey(key.id)"
            />
          </div>
        </UCard>
      </div>
    </template>

    <UModal v-model:open="showNewKeyModal">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-check-circle"
                class="size-5 text-success"
              />
              <h3 class="font-semibold">
                API Key Created
              </h3>
            </div>
          </template>

          <div class="space-y-4">
            <UAlert
              color="warning"
              icon="i-lucide-alert-triangle"
              title="Copy this key now"
              description="You won't be able to see it again."
            />

            <div class="bg-elevated p-3 rounded-lg">
              <div class="flex items-center gap-2">
                <code class="flex-1 text-sm font-mono break-all select-all">{{ newKeyValue }}</code>
                <UButton
                  variant="ghost"
                  icon="i-lucide-copy"
                  size="xs"
                  @click="copyToClipboard(newKeyValue!)"
                />
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-2">
                <p class="text-sm font-medium">
                  MCP Config
                </p>
                <UButton
                  variant="ghost"
                  icon="i-lucide-copy"
                  size="xs"
                  @click="copyToClipboard(mcpConfigWithKey)"
                />
              </div>
              <pre class="text-xs bg-elevated p-3 rounded-lg overflow-x-auto"><code>{{ mcpConfigWithKey }}</code></pre>
            </div>
          </div>

          <template #footer>
            <UButton
              label="Done"
              block
              @click="showNewKeyModal = false; newKeyValue = null"
            />
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
