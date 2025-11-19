import type { McpResourceDefinition } from '../definitions/resources'

export interface ValidationError {
  file?: string
  message: string
  suggestion?: string
}

/**
 * Validate an MCP resource definition
 */
export function validateResourceDefinition(
  resource: McpResourceDefinition,
  filePath?: string,
): ValidationError[] {
  const errors: ValidationError[] = []

  // Check if it's a file resource
  const isFileResource = 'file' in resource && !!resource.file

  // Validate handler
  if (!resource.handler && !isFileResource) {
    errors.push({
      file: filePath,
      message: 'Resource definition is missing a handler function',
      suggestion: 'Add a handler function: handler: async (uri) => { ... }',
    })
  }

  // Validate URI
  if (!resource.uri && !isFileResource) {
    errors.push({
      file: filePath,
      message: 'Resource definition is missing a URI',
      suggestion: 'Add a URI string or ResourceTemplate: uri: "file:///path/to/resource"',
    })
  }
  else if (resource.uri && typeof resource.uri !== 'string' && typeof resource.uri !== 'object') {
    errors.push({
      file: filePath,
      message: 'Resource URI must be a string or ResourceTemplate',
      suggestion: 'Use a string URI or ResourceTemplate instance',
    })
  }

  // Validate handler is a function
  if (resource.handler && typeof resource.handler !== 'function') {
    errors.push({
      file: filePath,
      message: 'Resource handler must be a function',
      suggestion: 'Ensure handler is defined as: handler: async (uri) => { ... }',
    })
  }

  return errors
}

/**
 * Validate multiple resource definitions
 */
export function validateResourceDefinitions(
  resources: McpResourceDefinition[],
  filePaths?: string[],
): ValidationError[] {
  const errors: ValidationError[] = []

  for (let i = 0; i < resources.length; i++) {
    const resource = resources[i]
    if (!resource) continue
    const filePath = filePaths?.[i]
    const resourceErrors = validateResourceDefinition(resource, filePath)
    errors.push(...resourceErrors)
  }

  return errors
}
