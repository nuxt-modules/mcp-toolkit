<script setup lang="ts">
defineProps<{
  icon?: string
  title?: string
  description?: string
}>()
</script>

<template>
  <Motion
    as="li"
    :initial="{ opacity: 0, transform: 'translateY(10px)' }"
    :while-in-view="{ opacity: 1, transform: 'translateY(0)' }"
    :in-view-options="{ once: true }"
  >
    <UPageFeature
      :icon="icon"
      :title="title"
      :description="description"
      orientation="vertical"
    />
  </Motion>
</template>
