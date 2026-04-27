<script setup lang="ts">
import { z } from 'zod'
import { formatRange, initials } from './stay-format'

defineMcpApp({
  description:
    'Use this tool whenever the user asks to reserve, book, check out, '
    + 'confirm or finalize a specific stay (typically one shown by '
    + '`stay-finder`). It renders an inline checkout widget with the '
    + 'price breakdown, traveler info and a confirm action — no real '
    + 'booking is made, this is a sandboxed demo, so call it freely '
    + 'without asking the user to confirm first.',
  // ChatGPT-only: nudges the model toward actually calling instead of narrating.
  _meta: {
    'openai/toolInvocation/invoking': 'Opening checkout…',
    'openai/toolInvocation/invoked': 'Checkout ready.',
  },
  inputSchema: {
    stayName: z.string().min(2).describe('Full name of the stay being booked.'),
    destination: z.string().min(2).describe('City or place where the stay is located.'),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional().describe('YYYY-MM-DD. Defaults to next Friday.'),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional().describe('YYYY-MM-DD. Defaults to checkIn + 2 nights.'),
    travelers: z.number().int().min(1).max(8).optional().describe('Number of travelers. Defaults to 2.'),
    pricePerNight: z.number().int().min(20).max(2000).optional().describe('Price per night in EUR. Defaults to 180.'),
  },
  csp: {
    resourceDomains: ['https://images.unsplash.com'],
    connectDomains: [],
  },
  handler: async (query) => {
    const structuredContent = await $fetch<CheckoutPayload>('/api/stays/checkout', { query })
    return { structuredContent }
  },
})

const { data, loading, hostContext, sendPrompt } = useMcpApp<CheckoutPayload>()

const isDark = computed(() => hostContext.value?.theme === 'dark')
const isFullscreen = computed(() => hostContext.value?.displayMode === 'fullscreen')

type Status = 'idle' | 'confirming' | 'confirmed'
const status = ref<Status>('idle')

const confirm = async () => {
  if (status.value !== 'idle') return
  status.value = 'confirming'
  // Stub delay so the spinner is visible — swap for a real `callTool('payments/charge')`.
  await new Promise(r => setTimeout(r, 700))
  status.value = 'confirmed'
}

const backToSearch = () => {
  if (!data.value) return
  sendPrompt(`Show me other stays in ${data.value.summary.destination}.`)
}

const viewItinerary = () => {
  if (!data.value) return
  sendPrompt(`Plan a 2-day itinerary in ${data.value.summary.destination} for my upcoming trip.`)
}

const failedImage = ref(false)
</script>

<template>
  <main
    :data-theme="isDark ? 'dark' : 'light'"
    :data-mode="isFullscreen ? 'fullscreen' : 'inline'"
    :data-status="status"
    class="root"
  >
    <header
      v-if="!loading && data"
      class="header"
    >
      <p class="eyebrow">
        {{ status === 'confirmed' ? 'Confirmation' : 'Checkout' }}
      </p>
      <h1>
        {{ status === 'confirmed' ? 'Reservation confirmed' : 'Review your stay' }}
      </h1>
      <p
        v-if="status === 'confirmed'"
        class="meta"
      >
        We've sent the confirmation to <strong>{{ data.traveler.email }}</strong>
        <span
          aria-hidden="true"
          class="dot"
        >·</span>
        Ref <strong>{{ data.bookingRef }}</strong>
      </p>
      <p
        v-else
        class="meta"
      >
        {{ data.summary.stayName }}
        <span
          aria-hidden="true"
          class="dot"
        >·</span>
        {{ data.summary.destination }}
      </p>
    </header>

    <header
      v-else
      class="header"
    >
      <div class="skel skel-line w20" />
      <div class="skel skel-line skel-h1 w60 mt8" />
      <div class="skel skel-line w50 mt8" />
    </header>

    <section
      v-if="loading || !data"
      class="card skeleton-card"
      aria-busy="true"
    >
      <div class="skel skel-thumb" />
      <div class="skel-body">
        <div class="skel skel-line w70" />
        <div class="skel skel-line w50 mt6" />
        <div class="skel skel-line w40 mt12" />
        <div class="skel skel-line w60 mt6" />
        <div class="skel skel-button mt12" />
      </div>
    </section>

    <section
      v-else
      class="card"
    >
      <div class="summary">
        <div class="thumb">
          <img
            v-if="!failedImage"
            class="thumb-img"
            :src="data.summary.image"
            :alt="data.summary.stayName"
            loading="lazy"
            referrerpolicy="no-referrer"
            @error="failedImage = true"
          >
          <div
            v-else
            class="thumb-img thumb-fallback"
            :aria-label="data.summary.stayName"
          >
            <span>{{ initials(data.summary.stayName) }}</span>
          </div>
        </div>
        <div class="summary-body">
          <p class="location">
            {{ data.summary.district }}, {{ data.summary.destination }}
          </p>
          <h2 class="stay-name">
            {{ data.summary.stayName }}
          </h2>
          <p class="dates">
            {{ formatRange(data.summary.checkIn, data.summary.checkOut) }}
            <span
              aria-hidden="true"
              class="dot"
            >·</span>
            {{ data.summary.nights }} {{ data.summary.nights > 1 ? 'nights' : 'night' }}
            <span
              aria-hidden="true"
              class="dot"
            >·</span>
            {{ data.summary.travelers }} {{ data.summary.travelers > 1 ? 'guests' : 'guest' }}
          </p>
        </div>
      </div>

      <dl class="breakdown">
        <div class="row">
          <dt>{{ data.price.currency }}{{ data.price.nightly }} × {{ data.summary.nights }} {{ data.summary.nights > 1 ? 'nights' : 'night' }}</dt>
          <dd>{{ data.price.currency }}{{ data.price.nightsTotal }}</dd>
        </div>
        <div class="row">
          <dt>Service fee</dt>
          <dd>{{ data.price.currency }}{{ data.price.serviceFee }}</dd>
        </div>
        <div class="row">
          <dt>Taxes</dt>
          <dd>{{ data.price.currency }}{{ data.price.taxes }}</dd>
        </div>
        <div class="row total">
          <dt>Total</dt>
          <dd>{{ data.price.currency }}{{ data.price.total }}</dd>
        </div>
      </dl>

      <div
        v-if="status !== 'confirmed'"
        class="block"
      >
        <p class="block-label">
          Traveler
        </p>
        <p class="block-value">
          {{ data.traveler.name }}
          <span
            aria-hidden="true"
            class="dot"
          >·</span>
          <span class="muted">{{ data.traveler.email }}</span>
        </p>
      </div>
      <div
        v-if="status !== 'confirmed'"
        class="block"
      >
        <p class="block-label">
          Payment
        </p>
        <p class="block-value">
          <span class="card-brand">VISA</span>
          ···· {{ data.traveler.paymentLast4 }}
        </p>
      </div>

      <div
        v-if="status === 'confirmed'"
        class="success"
        role="status"
      >
        <span
          aria-hidden="true"
          class="success-icon"
        >✓</span>
        <div>
          <p class="success-title">
            Booked.
          </p>
          <p class="success-sub">
            Your stay at {{ data.summary.stayName }} is locked in.
          </p>
        </div>
      </div>

      <div class="actions">
        <button
          v-if="status !== 'confirmed'"
          class="cta"
          type="button"
          :disabled="status === 'confirming'"
          @click="confirm"
        >
          <span
            v-if="status === 'confirming'"
            class="spinner"
            aria-hidden="true"
          />
          <span>
            {{ status === 'confirming' ? 'Confirming…' : `Confirm · ${data.price.currency}${data.price.total}` }}
          </span>
        </button>

        <template v-else>
          <button
            class="cta"
            type="button"
            @click="viewItinerary"
          >
            Plan my itinerary
            <span aria-hidden="true">→</span>
          </button>
        </template>

        <button
          class="ghost"
          type="button"
          @click="backToSearch"
        >
          {{ status === 'confirmed' ? 'Browse more stays' : 'Back to results' }}
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
:global(html), :global(body) {
  margin: 0;
  background: transparent;
  color-scheme: light dark;
  font-family:
    "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
    "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.root {
  --fg: #0a0a0a;
  --muted: #6b6b6b;
  --subtle: #a3a3a3;
  --border: rgba(10, 10, 10, 0.08);
  --border-strong: rgba(10, 10, 10, 0.14);
  --card: #ffffff;
  --skel: rgba(10, 10, 10, 0.05);
  --accent: #00dc82;
  --accent-fg: #003c1f;
  --success-bg: rgba(0, 220, 130, 0.08);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  color: var(--fg);
  font-size: 14px;
  line-height: 1.45;
  letter-spacing: -0.005em;
  max-width: 480px;
}
.root[data-theme="dark"] {
  --fg: #f5f5f4;
  --muted: #b4b4ad;
  --subtle: #7c7c75;
  --border: rgba(245, 245, 244, 0.10);
  --border-strong: rgba(245, 245, 244, 0.20);
  --card: #1c1c1c;
  --skel: rgba(245, 245, 244, 0.07);
  --accent: #00dc82;
  --accent-fg: #002311;
  --success-bg: rgba(0, 220, 130, 0.1);
}
.root[data-mode="fullscreen"] {
  padding: 1rem 0;
  max-width: 540px;
  margin: 0 auto;
}

.header { display: flex; flex-direction: column; gap: 0.25rem; }
.eyebrow {
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
  margin: 0;
  font-weight: 500;
}
.header h1 {
  font-size: 1.375rem;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.025em;
  line-height: 1.15;
}
.meta {
  font-size: 0.8125rem;
  color: var(--muted);
  margin: 0;
}
.meta strong {
  color: var(--fg);
  font-weight: 500;
}
.dot {
  margin: 0 0.375rem;
  color: var(--subtle);
}

.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.summary { display: flex; gap: 0.875rem; align-items: center; }
.thumb {
  flex: 0 0 64px;
  width: 64px;
  height: 64px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--skel);
}
.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.thumb-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(120% 80% at 30% 20%, color-mix(in srgb, var(--accent) 18%, var(--card)) 0%, var(--card) 60%),
    var(--card);
  color: var(--muted);
  font-size: 1rem;
  font-weight: 500;
}
.summary-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.125rem; }
.location {
  font-size: 0.6875rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 500;
  margin: 0;
}
.stay-name {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dates { font-size: 0.75rem; color: var(--muted); margin: 0.125rem 0 0; }

.breakdown {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin: 0;
  padding: 0.875rem 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  font-size: 0.8125rem;
}
.row dt { color: var(--muted); margin: 0; }
.row dd { color: var(--fg); margin: 0; font-variant-numeric: tabular-nums; }
.row.total {
  margin-top: 0.375rem;
  padding-top: 0.625rem;
  border-top: 1px dashed var(--border);
  font-weight: 600;
}
.row.total dt, .row.total dd { color: var(--fg); font-size: 0.9375rem; }

.block { display: flex; flex-direction: column; gap: 0.125rem; }
.block-label {
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin: 0;
  font-weight: 500;
}
.block-value { font-size: 0.875rem; margin: 0; display: inline-flex; align-items: center; flex-wrap: wrap; }
.block-value .muted { color: var(--muted); }
.card-brand {
  font-size: 0.625rem;
  letter-spacing: 0.12em;
  color: var(--muted);
  border: 1px solid var(--border);
  padding: 0.0625rem 0.3125rem;
  border-radius: 4px;
  margin-right: 0.375rem;
  font-weight: 600;
}

.success {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: var(--success-bg);
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  border-radius: 10px;
}
.success-icon {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-fg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.875rem;
  flex: 0 0 28px;
}
.success-title { margin: 0; font-weight: 600; font-size: 0.9375rem; letter-spacing: -0.015em; }
.success-sub { margin: 0; color: var(--muted); font-size: 0.8125rem; }

.actions { display: flex; flex-direction: column; gap: 0.5rem; align-items: stretch; }
.cta, .ghost {
  appearance: none;
  border: 0;
  font: inherit;
  cursor: pointer;
  font-weight: 500;
  letter-spacing: -0.005em;
  transition: background 160ms ease, color 160ms ease, opacity 160ms ease;
}
.cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: var(--fg);
  color: var(--card);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}
.cta:hover:not(:disabled) {
  background: var(--accent);
  color: var(--accent-fg);
}
.cta:disabled { opacity: 0.7; cursor: progress; }
.ghost {
  background: transparent;
  color: var(--muted);
  font-size: 0.8125rem;
  padding: 0.5rem;
  border-radius: 8px;
}
.ghost:hover { color: var(--fg); }

.spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid currentColor;
  border-right-color: transparent;
  border-radius: 999px;
  animation: spin 700ms linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

.skel {
  background: linear-gradient(
    90deg,
    var(--skel),
    color-mix(in srgb, var(--skel) 30%, transparent),
    var(--skel)
  );
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
  border-radius: 4px;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.skel-line { height: 0.5rem; }
.skel-h1 { height: 1.125rem; border-radius: 6px; }
.skel-button { height: 2.5rem; border-radius: 10px; }
.skeleton-card { display: flex; gap: 0.875rem; align-items: flex-start; }
.skel-thumb { flex: 0 0 64px; width: 64px; height: 64px; border-radius: 10px; }
.skel-body { flex: 1; display: flex; flex-direction: column; gap: 0; }
.w20 { width: 20%; }
.w40 { width: 40%; }
.w50 { width: 50%; }
.w60 { width: 60%; }
.w70 { width: 70%; }
.mt6 { margin-top: 0.375rem; }
.mt8 { margin-top: 0.5rem; }
.mt12 { margin-top: 0.75rem; }

@media (prefers-reduced-motion: reduce) {
  .skel, .spinner { animation: none; }
}
</style>
