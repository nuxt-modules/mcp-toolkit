import type { McpToolDefinition } from '../definitions/tools'
import type { ZodRawShape } from 'zod'

export interface ValidationError {
  file?: string
  message: string
  suggestion?: string
}

/**
 * Validate an MCP tool definition
 */
export function validateToolDefinition(
  tool: McpToolDefinition,
  filePath?: string,
): ValidationError[] {
  const errors: ValidationError[] = []

  // Validate name (will be auto-generated if missing, but we check handler)
  if (!tool.handler) {
    errors.push({
      file: filePath,
      message: 'Tool definition is missing a handler function',
      suggestion: 'Add a handler function: handler: async (args) => { ... }',
    })
  }

  // Validate inputSchema
  if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
    errors.push({
      file: filePath,
      message: 'Tool definition is missing or has invalid inputSchema',
      suggestion: 'Add an inputSchema object with Zod schemas: inputSchema: { param: z.string() }',
    })
  }
  else {
    // Validate that inputSchema is a ZodRawShape (object with Zod schemas)
    const schema = tool.inputSchema as ZodRawShape
    for (const [key, value] of Object.entries(schema)) {
      if (!value || typeof value !== 'object') {
        errors.push({
          file: filePath,
          message: `inputSchema property "${key}" is not a valid Zod schema`,
          suggestion: `Use a Zod schema: ${key}: z.string() or z.number(), etc.`,
        })
      }
    }
  }

  // Validate handler is a function
  if (tool.handler && typeof tool.handler !== 'function') {
    errors.push({
      file: filePath,
      message: 'Tool handler must be a function',
      suggestion: 'Ensure handler is defined as: handler: async (args) => { ... }',
    })
  }

  return errors
}

/**
 * Validate multiple tool definitions
 */
export function validateToolDefinitions(
  tools: McpToolDefinition[],
  filePaths?: string[],
): ValidationError[] {
  const errors: ValidationError[] = []

  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i]
    if (!tool) continue
    const filePath = filePaths?.[i]
    const toolErrors = validateToolDefinition(tool, filePath)
    errors.push(...toolErrors)
  }

  return errors
}
