<script setup lang="ts">
const features = [
  { title: 'Tools', description: 'Create executable functions that allow AI models to perform actions and retrieve information.', icon: 'i-lucide-hammer' },
  { title: 'Resources', description: 'Share data like files, database records or API responses as context for AI models.', icon: 'i-lucide-file-text' },
  { title: 'Prompts', description: 'Build reusable templates and workflows to guide AI interactions and standardize usage.', icon: 'i-lucide-terminal-square' },
]

const tabs = ['Tools', 'Resources', 'Prompts'] as const
const activeTab = ref(0)
</script>

<template>
  <UPageSection
    :features="features"
    orientation="horizontal"
    :ui="{ container: 'lg:items-start' }"
  >
    <template #title>
      <ChromaText>
        <slot
          name="title"
          mdc-unwrap="p"
        />
      </ChromaText>
    </template>

    <template #description>
      <slot
        name="description"
        mdc-unwrap="p"
      />
    </template>

    <ClientOnly>
      <div>
        <div class="flex border-b border-default mb-4">
          <button
            v-for="(tab, i) in tabs"
            :key="tab"
            class="px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2"
            :class="activeTab === i ? 'border-primary text-highlighted' : 'border-transparent text-muted hover:text-highlighted'"
            @click="activeTab = i"
          >
            {{ tab }}
          </button>
        </div>
        <div
          v-show="activeTab === 0"
          class="*:my-0"
        >
          <slot name="tools" />
        </div>
        <div
          v-show="activeTab === 1"
          class="*:my-0"
        >
          <slot name="resources" />
        </div>
        <div
          v-show="activeTab === 2"
          class="*:my-0"
        >
          <slot name="prompts" />
        </div>
      </div>
    </ClientOnly>
  </UPageSection>
</template>
