<template>
  <UPageSection
    :ui="{
      title: 'text-left',
      description: 'text-left',
      root: 'bg-linear-to-b border-t border-default from-muted dark:from-muted/40 to-default',
      features: 'xl:grid-cols-4 lg:gap-10',
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

    <template #features>
      <slot name="features" />
    </template>
  </UPageSection>
</template>
