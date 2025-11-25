<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <UButton
    v-if="route.path === '/'"
    to="/getting-started/installation"
    label="Get Started"
    variant="ghost"
    trailing
    icon="i-lucide-arrow-right"
  />
</template>
