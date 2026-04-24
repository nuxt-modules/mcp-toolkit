<script setup lang="ts">
import { z } from 'zod'

defineMcpApp({
  description: 'Pick a color and surface its hex value back to the conversation.',
  inputSchema: {
    initialColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/u, 'Hex color (e.g. #ff8800)')
      .optional()
      .describe('Optional starting color shown when the picker first opens.'),
  },
})

const { data, sendPrompt } = useMcpApp<{ initialColor?: string }>()
const color = ref(data.value?.initialColor ?? '#3b82f6')
</script>

<template>
  <main class="picker">
    <header>
      <h1>Pick a color</h1>
      <p class="hint">
        Drag the swatch, then hand the value back to the chat.
      </p>
    </header>

    <label
      class="swatch"
      :style="{ background: color }"
    >
      <input
        v-model="color"
        type="color"
        aria-label="Pick a color"
      >
    </label>

    <output class="value">{{ color.toUpperCase() }}</output>

    <button
      class="confirm"
      type="button"
      @click="sendPrompt(`I picked ${color.toUpperCase()}.`)"
    >
      Use {{ color.toUpperCase() }}
    </button>
  </main>
</template>

<style scoped>
:global(body) {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background: #f8fafc;
  color: #0f172a;
}

.picker {
  max-width: 320px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  text-align: center;
}

h1 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.hint {
  font-size: 0.75rem;
  margin: 0.25rem 0 0;
  color: #64748b;
}

.swatch {
  position: relative;
  width: 8rem;
  height: 8rem;
  border-radius: 9999px;
  box-shadow: inset 0 0 0 4px rgba(255, 255, 255, 0.4), 0 1px 4px rgba(15, 23, 42, 0.1);
  cursor: pointer;
  overflow: hidden;
  transition: transform 120ms ease;
}
.swatch:hover {
  transform: scale(1.02);
}
.swatch input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.value {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 1.125rem;
  letter-spacing: 0.05em;
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  background: white;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.confirm {
  appearance: none;
  border: 0;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  font-size: 0.875rem;
  padding: 0.5rem 0.875rem;
  border-radius: 9999px;
  background: #0f172a;
  color: white;
  transition: transform 120ms ease, opacity 120ms ease;
}
.confirm:hover {
  transform: translateY(-1px);
}
.confirm:active {
  opacity: 0.85;
}
</style>
