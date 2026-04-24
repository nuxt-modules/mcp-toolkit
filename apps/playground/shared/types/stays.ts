// Shared between the `/api/stays*` endpoints and the `stay-*` MCP App SFCs.

export interface Stay {
  id: string
  name: string
  rating: number
  reviewLabel: string
  reviewCount: number
  stars: number
  city: string
  district: string
  image: string
  amenities: Array<{ icon: string, label: string }>
  pricePerNight: number
  totalPrice: number
  bookingUrl: string
}

export interface StayQuery {
  destination: string
  checkIn: string
  checkOut: string
  travelers: number
  nights: number
}

export interface StayPayload {
  query: StayQuery
  stays: Stay[]
}

export interface CheckoutSummary {
  stayName: string
  destination: string
  district: string
  image: string
  checkIn: string
  checkOut: string
  travelers: number
  nights: number
}

export interface CheckoutPriceBreakdown {
  nightly: number
  nightsTotal: number
  serviceFee: number
  taxes: number
  total: number
  currency: string
}

export interface CheckoutTraveler {
  name: string
  email: string
  paymentLast4: string
}

export interface CheckoutPayload {
  summary: CheckoutSummary
  price: CheckoutPriceBreakdown
  traveler: CheckoutTraveler
  bookingRef: string
}
