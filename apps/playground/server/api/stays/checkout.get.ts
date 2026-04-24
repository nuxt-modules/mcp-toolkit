import { z } from 'zod'
import type { CheckoutPayload } from '#shared/types/stays'

const QuerySchema = z.object({
  stayName: z.string().min(2),
  destination: z.string().min(2),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
  travelers: z.coerce.number().int().min(1).max(8).optional(),
  pricePerNight: z.coerce.number().int().min(20).max(2000).optional(),
})

export default defineEventHandler(async (event): Promise<CheckoutPayload> => {
  const { stayName, destination, checkIn, checkOut, travelers, pricePerNight }
    = await getValidatedQuery(event, QuerySchema.parse)

  const start = checkIn ?? nextFriday()
  const end = checkOut ?? addDays(start, 2)
  const nights = Math.max(1, daysBetween(start, end))

  return buildCheckoutPayload({
    stayName,
    destination,
    checkIn: start,
    checkOut: end,
    travelers: travelers ?? 2,
    nights,
    pricePerNight: pricePerNight ?? 180,
  })
})
