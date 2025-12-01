<script setup lang="ts">
import { computed } from 'vue'

export type SupportedIDE = 'cursor' | 'vscode'

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

export interface InstallButtonProps {
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
   * Target IDE
   * @default 'cursor'
   */
  ide?: SupportedIDE
  /**
   * Button label (auto-generated based on IDE if not provided)
   */
  label?: string
  /**
   * Show the IDE icon
   * @default true
   */
  showIcon?: boolean
}

const IDE_CONFIG = {
  cursor: {
    name: 'Cursor',
    defaultLabel: 'Install in Cursor',
    generateDeeplink: (name: string, config: McpConfig) => {
      const configBase64 = btoa(JSON.stringify(config))
      return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(name)}&config=${configBase64}`
    },
  },
  vscode: {
    name: 'VS Code',
    defaultLabel: 'Install in VS Code',
    generateDeeplink: (name: string, config: McpConfig) => {
      const configJson = JSON.stringify(config)
      return `vscode:mcp/install?name=${encodeURIComponent(name)}&config=${encodeURIComponent(configJson)}`
    },
  },
}

const props = withDefaults(defineProps<InstallButtonProps>(), {
  ide: 'cursor',
  showIcon: true,
})

const ideConfig = computed(() => IDE_CONFIG[props.ide])

const buttonLabel = computed(() => props.label ?? ideConfig.value.defaultLabel)

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
  throw new Error('InstallButton: either "url" or "config" prop is required')
})

const deeplink = computed(() => {
  return ideConfig.value.generateDeeplink(props.name, resolvedConfig.value)
})
</script>

<template>
  <a
    :href="deeplink"
    class="mcp-install-button"
    v-bind="$attrs"
  >
    <!-- Cursor Icon -->
    <svg
      v-if="showIcon && ide === 'cursor'"
      class="mcp-install-button-icon"
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

    <!-- VS Code Icon -->
    <svg
      v-if="showIcon && ide === 'vscode'"
      class="mcp-install-button-icon mcp-install-button-icon--vscode"
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <mask
        id="mcp-vscode-mask"
        width="100"
        height="100"
        x="0"
        y="0"
        maskUnits="userSpaceOnUse"
      >
        <path
          fill="#fff"
          fill-rule="evenodd"
          d="M70.912 99.317a6.223 6.223 0 0 0 4.96-.19l20.589-9.907A6.25 6.25 0 0 0 100 83.587V16.413a6.25 6.25 0 0 0-3.54-5.632L75.874.874a6.226 6.226 0 0 0-7.104 1.21L29.355 38.04 12.187 25.01a4.162 4.162 0 0 0-5.318.236l-5.506 5.009a4.168 4.168 0 0 0-.004 6.162L16.247 50 1.36 63.583a4.168 4.168 0 0 0 .004 6.162l5.506 5.01a4.162 4.162 0 0 0 5.318.236l17.168-13.032L68.77 97.917a6.217 6.217 0 0 0 2.143 1.4ZM75.015 27.3 45.11 50l29.906 22.701V27.3Z"
          clip-rule="evenodd"
        />
      </mask>
      <g mask="url(#mcp-vscode-mask)">
        <path
          fill="#0065A9"
          d="M96.461 10.796 75.857.876a6.23 6.23 0 0 0-7.107 1.207l-67.451 61.5a4.167 4.167 0 0 0 .004 6.162l5.51 5.009a4.167 4.167 0 0 0 5.32.236l81.228-61.62c2.725-2.067 6.639-.124 6.639 3.297v-.24a6.25 6.25 0 0 0-3.539-5.63Z"
        />
        <path
          fill="#007ACC"
          d="m96.461 89.204-20.604 9.92a6.229 6.229 0 0 1-7.107-1.207l-67.451-61.5a4.167 4.167 0 0 1 .004-6.162l5.51-5.009a4.167 4.167 0 0 1 5.32-.236l81.228 61.62c2.725 2.067 6.639.124 6.639-3.297v.24a6.25 6.25 0 0 1-3.539 5.63Z"
        />
        <path
          fill="#1F9CF0"
          d="M75.858 99.126a6.232 6.232 0 0 1-7.108-1.21c2.306 2.307 6.25.674 6.25-2.588V4.672c0-3.262-3.944-4.895-6.25-2.589a6.232 6.232 0 0 1 7.108-1.21l20.6 9.908A6.25 6.25 0 0 1 100 16.413v67.174a6.25 6.25 0 0 1-3.541 5.633l-20.601 9.906Z"
        />
      </g>
    </svg>

    <span class="mcp-install-button-label">
      <slot>{{ buttonLabel }}</slot>
    </span>
  </a>
</template>

<style>
.mcp-install-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25rem;
  color: #fff;
  background-color: #171717;
  border: 1px solid #404040;
  border-radius: 0.375rem;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}

.mcp-install-button:hover {
  background-color: #262626;
  border-color: #525252;
}

.mcp-install-button:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.mcp-install-button-icon {
  filter: invert(1);
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
}

.mcp-install-button-icon--vscode {
  filter: none;
}

.mcp-install-button-label {
  white-space: nowrap;
}
</style>
