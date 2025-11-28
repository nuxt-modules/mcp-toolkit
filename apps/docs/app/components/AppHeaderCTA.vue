<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <div class="hidden md:block">
    <UButton
      v-if="route.path === '/'"
      to="/getting-started/installation"
      label="Get Started"
      variant="ghost"
      trailing
      icon="i-lucide-arrow-right"
    />
    <AiChat v-else />
  </div>
</template>
