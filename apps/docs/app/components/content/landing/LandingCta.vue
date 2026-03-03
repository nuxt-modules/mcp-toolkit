<script setup lang="ts">
defineProps<{
  links?: Array<Record<string, unknown>>
}>()
</script>

<template>
  <div class="relative overflow-hidden">
    <UPageCTA
      :links="links"
      class="relative z-10"
      :ui="{
        title: 'text-3xl sm:text-4xl',
        description: 'text-lg sm:text-xl text-muted',
        links: 'mt-8',
      }"
    >
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
    </UPageCTA>
  </div>
</template>
