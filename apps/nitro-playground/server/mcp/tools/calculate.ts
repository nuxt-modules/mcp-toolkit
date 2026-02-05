import { defineMcpTool, jsonResult } from 'nitro-mcp-toolkit'
import { z } from 'zod'

export default defineMcpTool({
  description: 'Perform basic arithmetic calculations',
  inputSchema: {
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']).describe('The operation to perform'),
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  },
  handler: async ({ operation, a, b }) => {
    let result: number

    switch (operation) {
      case 'add':
        result = a + b
        break
      case 'subtract':
        result = a - b
        break
      case 'multiply':
        result = a * b
        break
      case 'divide':
        if (b === 0) {
          return errorResult('Division by zero is not allowed')
        }
        result = a / b
        break
    }

    return jsonResult({
      operation,
      a,
      b,
      result,
    })
  },
})
