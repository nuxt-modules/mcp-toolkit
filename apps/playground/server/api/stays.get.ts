import { z } from 'zod'
import type { StayPayload } from '#shared/types/stays'

const QuerySchema = z.object({
  destination: z.string().min(2),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
  travelers: z.coerce.number().int().min(1).max(8).optional(),
})

export default defineEventHandler(async (event): Promise<StayPayload> => {
  const { destination, checkIn, checkOut, travelers } = await getValidatedQuery(event, QuerySchema.parse)

  const start = checkIn ?? nextFriday()
  const end = checkOut ?? addDays(start, 2)
  const nights = Math.max(1, daysBetween(start, end))
  const guests = travelers ?? 2

  return {
    query: { destination, checkIn: start, checkOut: end, travelers: guests, nights },
    stays: generateStays(destination, nights, guests),
  }
})
