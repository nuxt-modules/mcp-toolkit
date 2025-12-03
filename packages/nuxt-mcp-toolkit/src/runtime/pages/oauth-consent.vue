<script setup lang="ts">
import { useRoute, useFetch } from '#imports'
import { computed, ref } from 'vue'

const route = useRoute()
const requestId = computed(() => route.query.request_id as string)

const { data, error } = await useFetch<{
  appName: string
  clientName: string
  scopes: { key: string, label: string }[]
  callbackUrl: string
  user?: { name?: string, email?: string, image?: string }
}>('/api/__mcp/consent', {
  query: { request_id: requestId },
})

const isSubmitting = ref(false)

async function handleSubmit(approved: boolean) {
  if (!requestId.value || isSubmitting.value) return

  isSubmitting.value = true

  const form = document.createElement('form')
  form.method = 'POST'
  form.action = data.value?.callbackUrl || ''

  const requestIdInput = document.createElement('input')
  requestIdInput.type = 'hidden'
  requestIdInput.name = 'request_id'
  requestIdInput.value = requestId.value

  const approvedInput = document.createElement('input')
  approvedInput.type = 'hidden'
  approvedInput.name = 'approved'
  approvedInput.value = String(approved)

  form.appendChild(requestIdInput)
  form.appendChild(approvedInput)
  document.body.appendChild(form)
  form.submit()
}
</script>

<template>
  <div class="consent-page">
    <div
      v-if="error || !data"
      class="error-container"
    >
      <div class="error-icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
          />
          <line
            x1="15"
            y1="9"
            x2="9"
            y2="15"
          />
          <line
            x1="9"
            y1="9"
            x2="15"
            y2="15"
          />
        </svg>
      </div>
      <h1 class="error-title">
        Authorization Error
      </h1>
      <p class="error-message">
        {{ error?.data?.message || 'Invalid or expired authorization request' }}
      </p>
    </div>

    <div
      v-else
      class="consent-container"
    >
      <div class="logo">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          fill-rule="evenodd"
        >
          <path d="M15.688 2.343a2.588 2.588 0 00-3.61 0l-9.626 9.44a.863.863 0 01-1.203 0 .823.823 0 010-1.18l9.626-9.44a4.313 4.313 0 016.016 0 4.116 4.116 0 011.204 3.54 4.3 4.3 0 013.609 1.18l.05.05a4.115 4.115 0 010 5.9l-8.706 8.537a.274.274 0 000 .393l1.788 1.754a.823.823 0 010 1.18.863.863 0 01-1.203 0l-1.788-1.753a1.92 1.92 0 010-2.754l8.706-8.538a2.47 2.47 0 000-3.54l-.05-.049a2.588 2.588 0 00-3.607-.003l-7.172 7.034-.002.002-.098.097a.863.863 0 01-1.204 0 .823.823 0 010-1.18l7.273-7.133a2.47 2.47 0 00-.003-3.537z" />
          <path d="M14.485 4.703a.823.823 0 000-1.18.863.863 0 00-1.204 0l-7.119 6.982a4.115 4.115 0 000 5.9 4.314 4.314 0 006.016 0l7.12-6.982a.823.823 0 000-1.18.863.863 0 00-1.204 0l-7.119 6.982a2.588 2.588 0 01-3.61 0 2.47 2.47 0 010-3.54l7.12-6.982z" />
        </svg>
      </div>

      <h1 class="app-name">
        {{ data.appName }}
      </h1>

      <div
        v-if="data.user"
        class="user-section"
      >
        <div class="user-avatar">
          <img
            v-if="data.user.image"
            :src="data.user.image"
            :alt="data.user.name || 'User'"
          >
          <span v-else>{{ (data.user.name || data.user.email || 'U').charAt(0).toUpperCase() }}</span>
        </div>
        <div class="user-info">
          <span class="user-name">{{ data.user.name || data.user.email }}</span>
          <span
            v-if="data.user.email && data.user.name"
            class="user-email"
          >{{ data.user.email }}</span>
        </div>
      </div>

      <div class="divider" />

      <div class="client-section">
        <span class="client-name">{{ data.clientName }}</span>
        <span class="client-request">wants access to your account</span>
      </div>

      <div class="scopes">
        <div
          v-for="scope in data.scopes"
          :key="scope.key"
          class="scope-item"
        >
          <svg
            class="scope-check"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"
            />
          </svg>
          <span>{{ scope.label }}</span>
        </div>
      </div>

      <div class="buttons">
        <button
          class="btn btn-deny"
          :disabled="isSubmitting"
          @click="handleSubmit(false)"
        >
          Deny
        </button>
        <button
          class="btn btn-approve"
          :disabled="isSubmitting"
          @click="handleSubmit(true)"
        >
          <span
            v-if="isSubmitting"
            class="spinner"
          />
          Authorize
        </button>
      </div>

      <div class="footer">
        <svg
          class="footer-logo"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          fill-rule="evenodd"
        >
          <path d="M15.688 2.343a2.588 2.588 0 00-3.61 0l-9.626 9.44a.863.863 0 01-1.203 0 .823.823 0 010-1.18l9.626-9.44a4.313 4.313 0 016.016 0 4.116 4.116 0 011.204 3.54 4.3 4.3 0 013.609 1.18l.05.05a4.115 4.115 0 010 5.9l-8.706 8.537a.274.274 0 000 .393l1.788 1.754a.823.823 0 010 1.18.863.863 0 01-1.203 0l-1.788-1.753a1.92 1.92 0 010-2.754l8.706-8.538a2.47 2.47 0 000-3.54l-.05-.049a2.588 2.588 0 00-3.607-.003l-7.172 7.034-.002.002-.098.097a.863.863 0 01-1.204 0 .823.823 0 010-1.18l7.273-7.133a2.47 2.47 0 00-.003-3.537z" />
          <path d="M14.485 4.703a.823.823 0 000-1.18.863.863 0 00-1.204 0l-7.119 6.982a4.115 4.115 0 000 5.9 4.314 4.314 0 006.016 0l7.12-6.982a.823.823 0 000-1.18.863.863 0 00-1.204 0l-7.119 6.982a2.588 2.588 0 01-3.61 0 2.47 2.47 0 010-3.54l7.12-6.982z" />
        </svg>
        <span>MCP Toolkit</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.consent-page {
  min-height: 100vh;
  background: #0a0a0a;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.consent-container {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.logo {
  width: 40px;
  height: 40px;
  color: #22c55e;
}

.logo svg {
  width: 100%;
  height: 100%;
}

.app-name {
  font-size: 20px;
  font-weight: 600;
  color: #fafafa;
  text-align: center;
  margin: 0;
}

.user-section {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-avatar span {
  color: #fff;
  font-weight: 600;
  font-size: 14px;
}

.user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: #fafafa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 12px;
  color: #737373;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.divider {
  width: 32px;
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
}

.client-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}

.client-name {
  font-size: 18px;
  font-weight: 600;
  color: #fafafa;
}

.client-request {
  font-size: 14px;
  color: #737373;
}

.scopes {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.scope-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  font-size: 13px;
  color: #a3a3a3;
}

.scope-check {
  width: 16px;
  height: 16px;
  color: #22c55e;
  flex-shrink: 0;
}

.buttons {
  display: flex;
  gap: 12px;
  width: 100%;
  margin-top: 8px;
}

.btn {
  flex: 1;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
  outline: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-deny {
  background: transparent;
  color: #a3a3a3;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-deny:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  color: #fafafa;
}

.btn-approve {
  background: #22c55e;
  color: #fff;
}

.btn-approve:hover:not(:disabled) {
  background: #16a34a;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.footer {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #525252;
  margin-top: 16px;
}

.footer-logo {
  width: 12px;
  height: 12px;
  color: #22c55e;
  opacity: 0.6;
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  max-width: 320px;
  text-align: center;
}

.error-icon {
  width: 40px;
  height: 40px;
  color: #ef4444;
}

.error-icon svg {
  width: 100%;
  height: 100%;
}

.error-title {
  font-size: 18px;
  font-weight: 600;
  color: #fafafa;
  margin: 0;
}

.error-message {
  font-size: 14px;
  color: #737373;
  margin: 0;
  line-height: 1.5;
}
</style>
