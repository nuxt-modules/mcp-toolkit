<script setup lang="ts">
defineProps<{
  icon?: string
  title?: string
  description?: string
  to?: string
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
      :to="to"
      orientation="vertical"
    />
  </Motion>
</template>
