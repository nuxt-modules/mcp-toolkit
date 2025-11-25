<script setup lang="ts">
// @ts-expect-error yaml is not typed
import cta from './cta.yml'
</script>

<template>
  <div class="relative overflow-hidden">
    <UPageCTA
      v-bind="cta"
      class="relative z-10"
      :ui="{
        title: 'text-3xl sm:text-4xl',
        description: 'text-lg sm:text-xl text-muted',
        links: 'mt-8',
      }"
    >
      <template #title>
        <ChromaText>{{ cta.title }}</ChromaText>
      </template>
    </UPageCTA>
  </div>
</template>
