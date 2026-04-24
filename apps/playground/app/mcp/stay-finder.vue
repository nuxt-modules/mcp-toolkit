<script setup lang="ts">
import { z } from 'zod'
import type { Stay, StayPayload } from '#shared/types/stays'
import { formatRange, initials, starSlots } from './stay-format'

defineMcpApp({
  description: 'Show a horizontal carousel of stays for a destination, with photos, ratings, prices and booking links.',
  inputSchema: {
    destination: z.string().min(2).describe('City or place to search (e.g. "Milan", "Lisbon").'),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional().describe('YYYY-MM-DD. Defaults to next Friday.'),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional().describe('YYYY-MM-DD. Defaults to checkIn + 2 nights.'),
    travelers: z.number().int().min(1).max(8).optional().describe('Number of travelers. Defaults to 2.'),
  },
  csp: {
    resourceDomains: ['https://images.unsplash.com'],
    connectDomains: [],
  },
  handler: async (query) => {
    const structuredContent = await $fetch<StayPayload>('/api/stays', { query })
    return { structuredContent }
  },
})

const { data, loading, hostContext, sendPrompt } = useMcpApp<StayPayload>()

const isDark = computed(() => hostContext.value?.theme === 'dark')
const isFullscreen = computed(() => hostContext.value?.displayMode === 'fullscreen')

const failedImages = ref(new Set<string>())
const onImageError = (id: string) => {
  failedImages.value.add(id)
}

const reservingId = ref<string | null>(null)

const reserve = (stay: Stay) => {
  if (!data.value) return
  reservingId.value = stay.id
  const { destination, checkIn, checkOut, travelers } = data.value.query
  sendPrompt(
    `Book ${stay.name} in ${destination} from ${checkIn} to ${checkOut} for ${travelers} ${travelers > 1 ? 'guests' : 'guest'} (€${stay.pricePerNight}/night).`,
  )
  setTimeout(() => {
    if (reservingId.value === stay.id) reservingId.value = null
  }, 2000)
}
</script>

<template>
  <main
    :data-theme="isDark ? 'dark' : 'light'"
    :data-mode="isFullscreen ? 'fullscreen' : 'inline'"
    class="root"
  >
    <header
      v-if="!loading && data"
      class="header"
    >
      <p class="eyebrow">
        Curated stays
      </p>
      <h1>{{ data.query.destination }}</h1>
      <p class="meta">
        {{ formatRange(data.query.checkIn, data.query.checkOut) }}
        <span
          aria-hidden="true"
          class="dot"
        >·</span>
        {{ data.query.travelers }} {{ data.query.travelers > 1 ? 'guests' : 'guest' }}
        <span
          aria-hidden="true"
          class="dot"
        >·</span>
        {{ data.query.nights }} {{ data.query.nights > 1 ? 'nights' : 'night' }}
      </p>
    </header>

    <header
      v-else
      class="header"
    >
      <div class="skel skel-line w20" />
      <div class="skel skel-line skel-h1 w50 mt8" />
      <div class="skel skel-line w40 mt8" />
    </header>

    <section
      v-if="loading || !data"
      class="rail"
      aria-busy="true"
      aria-label="Loading stays"
    >
      <article
        v-for="n in 3"
        :key="n"
        class="card skel-card"
      >
        <div class="skel skel-image" />
        <div class="card-body">
          <div class="skel skel-line w70" />
          <div class="skel skel-line w50 mt8" />
          <div class="skel skel-line w40 mt12" />
          <div class="skel skel-button mt16" />
        </div>
      </article>
    </section>

    <section
      v-else
      :class="['rail', isFullscreen && 'rail-grid']"
    >
      <article
        v-for="stay in data.stays"
        :key="stay.id"
        class="card"
      >
        <div class="image-wrap">
          <img
            v-if="!failedImages.has(stay.id)"
            class="image"
            :src="stay.image"
            :alt="stay.name"
            loading="lazy"
            referrerpolicy="no-referrer"
            @error="onImageError(stay.id)"
          >
          <div
            v-else
            class="image image-fallback"
            :aria-label="stay.name"
          >
            <span class="image-fallback-text">{{ initials(stay.name) }}</span>
          </div>
          <div class="rating-pill">
            <span
              aria-hidden="true"
              class="rating-dot"
            />
            {{ stay.rating.toFixed(1) }}
          </div>
        </div>

        <div class="card-body">
          <div class="meta-row">
            <span class="location">{{ stay.district }}</span>
            <span
              v-if="stay.stars >= 3"
              :aria-label="`${stay.stars} stars`"
              class="stars"
            >
              <span
                v-for="(filled, i) in starSlots(stay.stars)"
                :key="i"
                :class="['star', filled && 'star-on']"
              >★</span>
            </span>
          </div>

          <h2 class="name">
            {{ stay.name }}
          </h2>

          <p class="review">
            <span class="review-label">{{ stay.reviewLabel }}</span>
            <span
              aria-hidden="true"
              class="dot"
            >·</span>
            {{ stay.reviewCount.toLocaleString() }} reviews
          </p>

          <ul class="amenities">
            <li
              v-for="a in stay.amenities"
              :key="a.label"
              class="amenity"
            >
              <span
                aria-hidden="true"
                class="amenity-icon"
              >{{ a.icon }}</span>
              {{ a.label }}
            </li>
          </ul>

          <div class="footer">
            <div class="price-block">
              <span class="price">€{{ stay.pricePerNight }}</span>
              <span class="price-sub">night</span>
            </div>
            <div class="actions">
              <button
                class="cta"
                type="button"
                :disabled="reservingId === stay.id"
                @click="reserve(stay)"
              >
                <template v-if="reservingId === stay.id">
                  Sent
                  <span aria-hidden="true">↗</span>
                </template>
                <template v-else>
                  Reserve
                  <span aria-hidden="true">→</span>
                </template>
              </button>
              <button
                class="ghost"
                type="button"
                @click="sendPrompt(`Tell me more about ${stay.name} in ${stay.city}.`)"
              >
                Details
              </button>
            </div>
          </div>
        </div>
      </article>
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
  --surface: #fafaf9;
  --skel: rgba(10, 10, 10, 0.05);
  --accent: #00dc82;
  --accent-fg: #003c1f;
  --star: #d4a93a;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  color: var(--fg);
  font-size: 14px;
  line-height: 1.45;
  letter-spacing: -0.005em;
  /* No vh-based max-height: vh inside an iframe resolves to ~0 → feedback loop. */
}

.root[data-theme="dark"] {
  --fg: #f5f5f4;
  --muted: #b4b4ad;
  --subtle: #7c7c75;
  --border: rgba(245, 245, 244, 0.10);
  --border-strong: rgba(245, 245, 244, 0.20);
  --card: #1c1c1c;
  --surface: #0a0a0a;
  --skel: rgba(245, 245, 244, 0.07);
  --accent: #00dc82;
  --accent-fg: #002311;
  --star: #e6c46a;
}

.root[data-mode="fullscreen"] {
  padding: 1rem 0;
}

/* --- Header --- */
.header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
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
.dot {
  margin: 0 0.375rem;
  color: var(--subtle);
}

/* --- Rail / Grid --- */
.rail {
  display: flex;
  gap: 0.875rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: thin;
  padding-bottom: 0.5rem;
  margin: 0 -0.125rem;
  padding-inline: 0.125rem;
}
.rail::-webkit-scrollbar { height: 4px; }
.rail::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: 999px;
}
.rail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  overflow: visible;
  gap: 1rem;
}

/* --- Card --- */
.card {
  flex: 0 0 280px;
  scroll-snap-align: start;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: border-color 200ms ease, transform 200ms ease;
}
.card:hover {
  border-color: var(--border-strong);
}

.image-wrap {
  position: relative;
  aspect-ratio: 4 / 3;
  background: var(--skel);
  overflow: hidden;
}
.image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 400ms ease;
}
.card:hover .image {
  transform: scale(1.03);
}
.image-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(120% 80% at 30% 20%, color-mix(in srgb, var(--accent) 18%, var(--card)) 0%, var(--card) 60%),
    var(--card);
  color: var(--muted);
  font-weight: 500;
  letter-spacing: -0.02em;
}
.image-fallback-text {
  font-size: 1.5rem;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}

.rating-pill {
  position: absolute;
  top: 0.625rem;
  left: 0.625rem;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: rgba(10, 10, 10, 0.72);
  color: #fafaf9;
  font-weight: 500;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}
.rating-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 0 2px rgba(0, 220, 130, 0.18);
}

/* --- Card body --- */
.card-body {
  padding: 0.875rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 1;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.location {
  font-size: 0.75rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 500;
}

.stars {
  color: var(--star);
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  white-space: nowrap;
}
.star { opacity: 0.2; }
.star-on { opacity: 1; }

.name {
  font-size: 1rem;
  font-weight: 600;
  margin: 0.125rem 0 0;
  letter-spacing: -0.02em;
  color: var(--fg);
  line-height: 1.25;
}

.review {
  font-size: 0.75rem;
  color: var(--muted);
  margin: 0;
}
.review-label {
  font-weight: 500;
  color: var(--fg);
}

.amenities {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.625rem;
}
.amenity {
  font-size: 0.6875rem;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
.amenity-icon {
  font-size: 0.75rem;
  filter: saturate(0.7);
}

/* --- Footer (price + actions) --- */
.footer {
  margin-top: auto;
  padding-top: 0.875rem;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.5rem;
}
.price-block {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  font-variant-numeric: tabular-nums;
}
.price {
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.025em;
}
.price-sub {
  font-size: 0.75rem;
  color: var(--muted);
}

.actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}
.cta, .ghost {
  appearance: none;
  border: 0;
  font: inherit;
  cursor: pointer;
  font-weight: 500;
  letter-spacing: -0.005em;
  transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
}
.cta {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border-radius: 999px;
  background: var(--fg);
  color: var(--card);
  font-size: 0.8125rem;
}
.cta:hover:not(:disabled) {
  background: var(--accent);
  color: var(--accent-fg);
}
.cta:disabled {
  background: var(--accent);
  color: var(--accent-fg);
  cursor: default;
  opacity: 0.85;
}
.ghost {
  background: transparent;
  color: var(--muted);
  font-size: 0.75rem;
  padding: 0.25rem 0.25rem;
}
.ghost:hover {
  color: var(--fg);
}

/* --- Skeleton --- */
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
.skel-image {
  aspect-ratio: 4 / 3;
  border-radius: 0;
}
.skel-line { height: 0.5rem; }
.skel-h1 { height: 1.125rem; border-radius: 6px; }
.skel-button {
  height: 2rem;
  width: 6rem;
  border-radius: 999px;
  margin-left: auto;
}
.skel-card .card-body {
  gap: 0;
}
.w20 { width: 20%; }
.w30 { width: 30%; }
.w40 { width: 40%; }
.w50 { width: 50%; }
.w60 { width: 60%; }
.w70 { width: 70%; }
.mt6 { margin-top: 0.375rem; }
.mt8 { margin-top: 0.5rem; }
.mt12 { margin-top: 0.75rem; }
.mt16 { margin-top: 1rem; }

@media (prefers-reduced-motion: reduce) {
  .skel { animation: none; }
  .image, .card { transition: none; }
}
</style>
