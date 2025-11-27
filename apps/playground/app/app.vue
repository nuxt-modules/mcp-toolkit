<script setup lang="ts">
useSeoMeta({
  title: 'Playground',
  description: 'A minimal todo app with Better Auth - MCP Toolkit Playground',
})
</script>

<template>
  <UApp :toaster="{ expand: false }">
    <NuxtLoadingIndicator />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
