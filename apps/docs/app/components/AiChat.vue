<script setup lang="ts">
const { toggle } = useAIChat()
</script>

<template>
  <div
    class="bg-primary rounded-full size-10"
    @click="toggle"
  />
</template>
