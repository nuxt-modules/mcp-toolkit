<script setup lang="ts">
// @ts-expect-error yaml is not typed
import features from './features.yml'
</script>

<template>
  <UPageSection
    :description="features.description"
    :ui="{
      title: 'text-left',
      description: 'text-left',
      root: 'bg-gradient-to-b border-t border-default from-muted dark:from-muted/40 to-default',
      features: 'xl:grid-cols-4 lg:gap-10',
    }"
  >
    <template #title>
      <ChromaText>{{ features.title }}</ChromaText>
    </template>

    <template #features>
      <Motion
        v-for="(feature, index) in features.items"
        :key="feature.title"
        as="li"
        :initial="{ opacity: 0, transform: 'translateY(10px)' }"
        :while-in-view="{ opacity: 1, transform: 'translateY(0)' }"
        :transition="{ delay: 0.1 * index }"
        :in-view-options="{ once: true }"
      >
        <UPageFeature
          v-bind="feature"
          orientation="vertical"
        />
      </Motion>
      <Motion
        as="li"
        :initial="{ opacity: 0, transform: 'translateY(10px)' }"
        :while-in-view="{ opacity: 1, transform: 'translateY(0)' }"
        :transition="{ delay: 0.1 * features.items.length }"
        :in-view-options="{ once: true }"
        class="flex flex-col justify-center gap-4 p-4 bg-muted/50 h-full"
      >
        <span class="text-lg font-semibold">
          {{ features.cta.title }}
        </span>
        <div>
          <UButton
            :to="features.cta.to"
            :label="features.cta.label"
            trailing
            :icon="features.cta.icon"
          />
        </div>
      </Motion>
    </template>
  </UPageSection>
</template>
