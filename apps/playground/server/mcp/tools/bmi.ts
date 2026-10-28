import { z } from 'zod'

export default defineMcpTool({
  name: 'calculate-bmi',
  title: 'BMI Calculator',
  description: 'Calculate Body Mass Index from weight and height',
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  _meta: { inputExamples: [
    { weightKg: 70, heightM: 1.75 },
  ] },
  inputSchema: z.object({
    weightKg: z.number().describe('Weight in kilograms'),
    heightM: z.number().describe('Height in meters'),
  }),
  outputSchema: z.object({
    bmi: z.number(),
    category: z.string(),
  }),
  handler: async ({ weightKg, heightM }) => {
    const bmi = weightKg / (heightM * heightM)
    let category = 'Normal'
    if (bmi < 18.5) category = 'Underweight'
    else if (bmi >= 30) category = 'Obese'
    else if (bmi >= 25) category = 'Overweight'

    const output = { bmi: Math.round(bmi * 100) / 100, category }
    return output
  },
})
