<script setup lang="ts">
defineProps<{
  lightImage?: string
  darkImage?: string
  imageAlt?: string
}>()
</script>

<template>
  <UPageSection :ui="{ container: 'lg:py-20' }">
    <template #title>
      <ChromaText>
        <slot
          name="title"
          mdc-unwrap="p"
        />
      </ChromaText>
    </template>

    <template #description>
      <slot
        name="description"
        mdc-unwrap="p"
      />
    </template>

    <UColorModeImage
      v-if="lightImage && darkImage"
      :light="lightImage"
      :dark="darkImage"
      :alt="imageAlt"
      class="w-full h-auto grayscale"
    />
  </UPageSection>
</template>
