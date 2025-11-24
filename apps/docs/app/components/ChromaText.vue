<script setup lang="ts">
defineProps<{
  as?: string
}>()
</script>

<template>
  <Motion
    :as="as || 'span'"
    :initial="{ backgroundPositionX: '100%', filter: 'blur(1px)' }"
    :in-view="{ backgroundPositionX: '0%', filter: 'blur(0px)' }"
    :in-view-options="{ once: true }"
    :transition="{ duration: 0.9, delay: 0.1, ease: 'easeInOut' }"
    class="chroma-text"
  >
    <slot />
  </Motion>
</template>
