<script setup lang="ts">
defineProps<{
  to?: string
  label?: string
  icon?: string
}>()
</script>

<template>
  <Motion
    as="li"
    :initial="{ opacity: 0, transform: 'translateY(10px)' }"
    :while-in-view="{ opacity: 1, transform: 'translateY(0)' }"
    :in-view-options="{ once: true }"
    class="flex flex-col justify-center gap-4 p-4 bg-muted/50 h-full"
  >
    <span class="text-lg font-semibold">
      <slot
        name="title"
        mdc-unwrap="p"
      />
    </span>
    <div>
      <UButton
        :to="to"
        :label="label"
        trailing
        :icon="icon"
      />
    </div>
  </Motion>
</template>
