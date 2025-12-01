<script setup lang="ts">
import { computed } from 'vue'

export interface StdioConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface HttpConfig {
  type: 'http' | 'sse'
  url: string
  headers?: Record<string, string>
}

export type McpConfig = StdioConfig | HttpConfig

export interface CursorInstallButtonProps {
  /**
   * Name of the MCP server (required)
   */
  name: string
  /**
   * URL for HTTP/SSE transport (shorthand for { type: 'http', url: '...' })
   */
  url?: string
  /**
   * Full MCP config object for stdio or http transport
   */
  config?: McpConfig
  /**
   * Button label
   * @default 'Install in Cursor'
   */
  label?: string
  /**
   * Show the Cursor icon
   * @default true
   */
  showIcon?: boolean
}

const props = withDefaults(defineProps<CursorInstallButtonProps>(), {
  label: 'Install in Cursor',
  showIcon: true,
})

const resolvedConfig = computed<McpConfig>(() => {
  if (props.config) {
    return props.config
  }
  if (props.url) {
    return {
      type: 'http',
      url: props.url,
    }
  }
  throw new Error('CursorInstallButton: either "url" or "config" prop is required')
})

const deeplink = computed(() => {
  const configJson = JSON.stringify(resolvedConfig.value)
  const configBase64 = btoa(configJson)
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(props.name)}&config=${configBase64}`
})
</script>

<template>
  <a
    :href="deeplink"
    class="mcp-cursor-install-button"
    v-bind="$attrs"
  >
    <svg
      v-if="showIcon"
      class="mcp-cursor-install-button-icon"
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="url(#mcp-cursor-fill-0)"
        d="M11.925 24l10.425-6-10.425-6L1.5 18l10.425 6z"
      />
      <path
        fill="url(#mcp-cursor-fill-1)"
        d="M22.35 18V6L11.925 0v12l10.425 6z"
      />
      <path
        fill="url(#mcp-cursor-fill-2)"
        d="M11.925 0L1.5 6v12l10.425-6V0z"
      />
      <path
        fill="#555"
        d="M22.35 6L11.925 24V12L22.35 6z"
      />
      <path
        fill="#000"
        d="M22.35 6l-10.425 6L1.5 6h20.85z"
      />
      <defs>
        <linearGradient
          id="mcp-cursor-fill-0"
          x1="11.925"
          x2="11.925"
          y1="12"
          y2="24"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            offset=".16"
            stop-color="#000"
            stop-opacity=".39"
          />
          <stop
            offset=".658"
            stop-color="#000"
            stop-opacity=".8"
          />
        </linearGradient>
        <linearGradient
          id="mcp-cursor-fill-1"
          x1="22.35"
          x2="11.925"
          y1="6.037"
          y2="12.15"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            offset=".182"
            stop-color="#000"
            stop-opacity=".31"
          />
          <stop
            offset=".715"
            stop-color="#000"
            stop-opacity="0"
          />
        </linearGradient>
        <linearGradient
          id="mcp-cursor-fill-2"
          x1="11.925"
          x2="1.5"
          y1="0"
          y2="18"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            stop-color="#000"
            stop-opacity=".6"
          />
          <stop
            offset=".667"
            stop-color="#000"
            stop-opacity=".22"
          />
        </linearGradient>
      </defs>
    </svg>
    <span class="mcp-cursor-install-button-label">
      <slot>{{ label }}</slot>
    </span>
  </a>
</template>

<style>
.mcp-cursor-install-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25rem;
  color: #fff;
  background-color: #171717;
  border: 0.75px solid #404040;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}

.mcp-cursor-install-button:hover {
  background-color: #262626;
  border-color: #525252;
}

.mcp-cursor-install-button:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.mcp-cursor-install-button-icon {
  filter: invert(1);
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
}

.mcp-cursor-install-button-label {
  white-space: nowrap;
}
</style>
