import type { McpPromptDefinition } from '../definitions/prompts'

export interface ValidationError {
  file?: string
  message: string
  suggestion?: string
}

/**
 * Validate an MCP prompt definition
 */
export function validatePromptDefinition(
  prompt: McpPromptDefinition,
  filePath?: string,
): ValidationError[] {
  const errors: ValidationError[] = []

  // Validate handler
  if (!prompt.handler) {
    errors.push({
      file: filePath,
      message: 'Prompt definition is missing a handler function',
      suggestion: 'Add a handler function: handler: async (args) => { ... } or handler: async () => { ... }',
    })
  }

  // Validate handler is a function
  if (prompt.handler && typeof prompt.handler !== 'function') {
    errors.push({
      file: filePath,
      message: 'Prompt handler must be a function',
      suggestion: 'Ensure handler is defined as: handler: async (args) => { ... }',
    })
  }

  // Validate inputSchema if provided
  if (prompt.inputSchema && typeof prompt.inputSchema !== 'object') {
    errors.push({
      file: filePath,
      message: 'Prompt inputSchema must be an object with Zod string schemas',
      suggestion: 'Use an object with Zod string schemas: inputSchema: { param: z.string() }',
    })
  }

  return errors
}

/**
 * Validate multiple prompt definitions
 */
export function validatePromptDefinitions(
  prompts: McpPromptDefinition[],
  filePaths?: string[],
): ValidationError[] {
  const errors: ValidationError[] = []

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i]
    if (!prompt) continue
    const filePath = filePaths?.[i]
    const promptErrors = validatePromptDefinition(prompt, filePath)
    errors.push(...promptErrors)
  }

  return errors
}
