import type { Stay } from '#shared/types/stays'

export function nextFriday(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7 || 7))
  return d.toISOString().slice(0, 10)
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string): number {
  const diff = Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

/** Tiny seeded PRNG: same destination → same stays across renders. */
export function seeded(input: string): () => number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = (h * 16777619) >>> 0
  }
  return () => {
    h = (h + 0x6d2b79f5) >>> 0
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const copy = arr.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

// Hand-picked Unsplash photo IDs — `image-fallback` covers any 404.
const HOTEL_PHOTOS = [
  '1566073771259-6a8506099945',
  '1551882547-ff40c63fe5fa',
  '1564501049412-61c2a3083791',
  '1455587734955-081b22074882',
  '1571896349842-33c89424de2d',
  '1542314831-068cd1dbfeeb',
  '1582719478250-c89cae4dc85b',
  '1520250497591-112f2f40a3f4',
  '1611892440504-42a792e24d32',
  '1564013799919-ab600027ffc6',
  '1518733057094-95b53143d2a7',
  '1631049307264-da0ec9d70304',
  '1551776235-dde6d482980b',
  '1590381105924-c72589b9ef3f',
] as const

const photoUrl = (id: string, w = 640, h = 480): string =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=80`

export function pickPhoto(seed: string, salt: number): string {
  const rand = seeded(`${seed}:${salt}`)
  rand() // discard the biased first draw
  return photoUrl(HOTEL_PHOTOS[Math.floor(rand() * HOTEL_PHOTOS.length)]!)
}

const NAME_PARTS = {
  prefixes: ['Casa', 'Hotel', 'IM HOME', 'Novotel', 'Ibis', 'Aparto', 'Maison', 'Lion'],
  cores: ['Centrale', 'Linate', 'Garibaldi', 'Duomo', 'Quartiere', 'Brera', 'Porta', 'Stazione'],
  suffixes: ['Suite', 'Boutique', 'Hostel', 'Aparthotel', 'Loft', 'Residence'],
}

const DISTRICTS = [
  'Central Station', 'Old Town', 'Riverside', 'Università',
  'Distretto Viale Monza', 'Brera', 'Porta Romana',
]

const REVIEW_LABELS = ['Excellent', 'Very good', 'Good', 'Wonderful', 'Pleasant']

const AMENITY_POOL: Array<{ icon: string, label: string }> = [
  { icon: '🅿️', label: 'Parking' },
  { icon: '🍽️', label: 'Restaurant' },
  { icon: '🐾', label: 'Pet friendly' },
  { icon: '🚭', label: 'Non-smoking rooms' },
  { icon: '👨‍👩‍👧', label: 'Family rooms' },
  { icon: '🌿', label: 'Garden' },
  { icon: '🕓', label: '24-hour front desk' },
  { icon: '🏊', label: 'Pool' },
  { icon: '📶', label: 'Free Wi-Fi' },
  { icon: '🍳', label: 'Breakfast included' },
]

export function generateStays(destination: string, nights: number, travelers: number): Stay[] {
  const rand = seeded(destination.toLowerCase().trim())
  const cleanDest = destination.replace(/[^\p{L}\p{N}\s,'-]/gu, '').trim() || 'the city'
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!

  const out: Stay[] = []
  for (let i = 0; i < 6; i++) {
    const useCompact = rand() < 0.4
    const name = useCompact
      ? `${pick(NAME_PARTS.prefixes)} ${pick(NAME_PARTS.cores)}`
      : `${pick(NAME_PARTS.prefixes)} ${pick(NAME_PARTS.cores)} ${pick(NAME_PARTS.suffixes)}`
    const stars = 2 + Math.floor(rand() * 4)
    const rating = Math.round((6.8 + rand() * 2.4) * 10) / 10
    const pricePerNight = 80 + Math.floor(rand() * 380)

    out.push({
      id: `stay-${i}`,
      name,
      rating,
      reviewLabel: pick(REVIEW_LABELS),
      reviewCount: 80 + Math.floor(rand() * 12_000),
      stars,
      city: cleanDest,
      district: pick(DISTRICTS),
      image: pickPhoto(destination.toLowerCase(), i),
      amenities: shuffle(AMENITY_POOL, rand).slice(0, 2 + Math.floor(rand() * 3)),
      pricePerNight,
      totalPrice: pricePerNight * nights,
      bookingUrl: `https://example.com/stay/${i}?travelers=${travelers}`,
    })
  }
  return out
}
