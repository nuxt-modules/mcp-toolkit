<script setup lang="ts">
// @ts-expect-error yaml is not typed
import devtools from './devtools.yml'
</script>

<template>
  <UPageSection
    :title="devtools.title"
    :description="devtools.description"
    :ui="{ container: 'lg:py-20' }"
  >
    <UColorModeImage
      :light="devtools.image.light"
      :dark="devtools.image.dark"
      :alt="devtools.image.alt"
      class="w-full h-auto grayscale"
    />
  </UPageSection>
</template>
