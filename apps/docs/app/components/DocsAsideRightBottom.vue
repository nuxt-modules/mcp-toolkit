<script setup lang="ts">
const route = useRoute()

const pageUrl = route.path
const { open } = useAIChat()
</script>

<template>
  <div>
    <UButton
      icon="i-lucide-brain"
      target="_blank"
      label="Explain with AI"
      size="sm"
      variant="ghost"
      @click="open(`Explain the page ${pageUrl}`, true)"
    />
    <AIChatSlideover />
    <AiChat class="absolute bottom-2 right-2" />
  </div>
</template>
