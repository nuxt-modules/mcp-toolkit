import type { CheckoutPayload } from '#shared/types/stays'

const DISTRICTS = [
  'Old Town',
  'Riverside',
  'Brera',
  'Boutique Quarter',
  'Marina',
  'Avenida',
]

export interface BuildCheckoutInput {
  stayName: string
  destination: string
  checkIn: string
  checkOut: string
  travelers: number
  nights: number
  pricePerNight: number
}

export function buildCheckoutPayload(input: BuildCheckoutInput): CheckoutPayload {
  const rand = seeded(input.stayName + '|' + input.destination)
  const district = DISTRICTS[Math.floor(rand() * DISTRICTS.length)]!

  const nightly = input.pricePerNight
  const nightsTotal = nightly * input.nights
  const serviceFee = Math.round(nightsTotal * 0.08)
  const taxes = Math.round(nightsTotal * 0.12)
  const total = nightsTotal + serviceFee + taxes
  const ref = Math.floor(rand() * 9000 + 1000)

  return {
    summary: {
      stayName: input.stayName,
      destination: input.destination,
      district,
      image: pickPhoto(`${input.destination.toLowerCase()}|${input.stayName.toLowerCase()}`, 0),
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      travelers: input.travelers,
      nights: input.nights,
    },
    price: {
      nightly,
      nightsTotal,
      serviceFee,
      taxes,
      total,
      currency: '€',
    },
    traveler: {
      name: 'Hugo Richard',
      email: 'hugo@example.com',
      paymentLast4: '4242',
    },
    bookingRef: `BK-${ref}`,
  }
}
