<script setup lang="ts">
// @ts-expect-error yaml is not typed
import code from './code.yml'
</script>

<template>
  <UPageSection
    :title="code.title"
    :description="code.description"
    :features="code.features"
    orientation="horizontal"
    :ui="{ container: 'lg:items-start' }"
  >
    <ClientOnly>
      <UTabs
        :items="code.items"
        :unmount-on-hide="false"
      >
        <template #content="{ item, index }">
          <LazyMDC
            :value="item.code"
            :cache-key="`landing-code-tab-${index}`"
            class="*:my-0"
            hydrate-on-idle
          />
        </template>
      </UTabs>
    </ClientOnly>
  </UPageSection>
</template>
