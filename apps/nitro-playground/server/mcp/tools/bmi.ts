import { defineMcpTool } from 'nitro-mcp-toolkit'
import { z } from 'zod'

/** Exercises `outputSchema`: the plain return lands in `structuredContent`. */
export default defineMcpTool({
  name: 'bmi',
  description: 'Compute a body mass index',
  inputSchema: z.object({
    weightKg: z.number().positive(),
    heightM: z.number().positive(),
  }),
  outputSchema: z.object({
    bmi: z.number(),
    category: z.enum(['underweight', 'normal', 'overweight']),
  }),
  handler: ({ weightKg, heightM }) => {
    const bmi = Number((weightKg / heightM ** 2).toFixed(1))
    return {
      bmi,
      category: bmi < 18.5 ? 'underweight' : bmi < 25 ? 'normal' : 'overweight',
    } as const
  },
})
