<script setup lang="ts">
import { useClipboard } from '@vueuse/core'

defineProps({
  value: {
    type: String,
    required: true,
  },
})
const { copy, copied } = useClipboard()
</script>

<template>
  <label>
    <UInput
      :model-value="value"
      size="lg"
      disabled
      class="w-68"
    >
      <div
        class="absolute inset-0"
        :class="[copied ? 'cursor-default' : 'cursor-copy']"
        @click="copy(value)"
      />
      <template #trailing>
        <UButton
          :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
          color="neutral"
          variant="link"
          :padded="false"
          :ui="{ leadingIcon: 'size-4' }"
          :class="{ 'text-primary hover:text-primary/80': copied }"
          aria-label="copy button"
          @click="copy(value)"
        />
      </template>
    </UInput>
  </label>
</template>
