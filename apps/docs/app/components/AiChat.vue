<script setup lang="ts">
const { toggle } = useAIChat()
</script>

<template>
  <UTooltip text="Ask AI a question">
    <UButton
      icon="i-lucide-sparkles"
      variant="ghost"
      class="rounded-full"
      @click="toggle"
    />
  </UTooltip>
</template>
