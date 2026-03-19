import { z } from 'zod'
import type { McpToolDefinition } from '../definitions/tools'
import { enrichNameTitle } from '../definitions/utils'

function sanitizeToolName(name: string): string {
  let sanitized = name.replace(/[^\w$]/g, '_')
  if (/^\d/.test(sanitized)) sanitized = `_${sanitized}`
  const reserved = ['break', 'case', 'catch', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'finally', 'for', 'function', 'if', 'in', 'instanceof', 'new', 'return', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'class', 'const', 'enum', 'export', 'extends', 'import', 'super', 'implements', 'interface', 'let', 'package', 'private', 'protected', 'public', 'static', 'yield', 'await', 'async']
  if (reserved.includes(sanitized)) sanitized = `${sanitized}_`
  return sanitized
}

function pascalCase(str: string): string {
  return str.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase())
}

function jsonSchemaPropertyToTs(prop: Record<string, unknown>): string {
  if (prop.enum && Array.isArray(prop.enum)) {
    return prop.enum.map(v => typeof v === 'string' ? `"${v}"` : String(v)).join(' | ')
  }

  const type = prop.type as string | string[] | undefined

  if (Array.isArray(type)) {
    return type.map(t => jsonSchemaPrimitiveToTs(t)).join(' | ')
  }

  if (type === 'object' && prop.properties) {
    const props = prop.properties as Record<string, Record<string, unknown>>
    const required = (prop.required as string[]) || []
    const fields = Object.entries(props).map(([key, value]) => {
      const opt = required.includes(key) ? '' : '?'
      return `${key}${opt}: ${jsonSchemaPropertyToTs(value)}`
    })
    return `{ ${fields.join('; ')} }`
  }

  if (type === 'array') {
    const items = prop.items as Record<string, unknown> | undefined
    const itemType = items ? jsonSchemaPropertyToTs(items) : 'unknown'
    return `${itemType}[]`
  }

  return type ? jsonSchemaPrimitiveToTs(type) : 'unknown'
}

function jsonSchemaPrimitiveToTs(type: string): string {
  switch (type) {
    case 'string': return 'string'
    case 'number':
    case 'integer': return 'number'
    case 'boolean': return 'boolean'
    case 'null': return 'null'
    case 'object': return 'Record<string, unknown>'
    case 'array': return 'unknown[]'
    default: return 'unknown'
  }
}

const PRIMITIVE_TYPES = new Set(['string', 'number', 'integer', 'boolean'])
const INLINE_THRESHOLD = 3

function isPrimitiveProp(prop: Record<string, unknown>): boolean {
  if (prop.enum) return true
  const type = prop.type as string | undefined
  return !!type && PRIMITIVE_TYPES.has(type)
}

interface ToolTypeInfo {
  originalName: string
  sanitizedName: string
  typeName: string
  interfaceDecl: string | null
  methodSignature: string
}

function generateToolTypeInfo(tool: McpToolDefinition): ToolTypeInfo {
  const { name } = enrichNameTitle({
    name: tool.name,
    title: tool.title,
    _meta: tool._meta,
    type: 'tool',
  })

  const sanitizedName = sanitizeToolName(name)
  const typeName = `${pascalCase(sanitizedName)}Input`

  let interfaceDecl: string | null = null
  let paramSignature = ''

  if (tool.inputSchema && Object.keys(tool.inputSchema).length > 0) {
    try {
      const jsonSchema = z.toJSONSchema(z.object(tool.inputSchema))
      const properties = jsonSchema.properties as Record<string, Record<string, unknown>> | undefined
      const required = (jsonSchema.required as string[]) || []

      if (properties && Object.keys(properties).length > 0) {
        const entries = Object.entries(properties)
        const allPrimitive = entries.every(([, prop]) => isPrimitiveProp(prop))

        if (entries.length <= INLINE_THRESHOLD && allPrimitive) {
          const inlineFields = entries.map(([key, prop]) => {
            const opt = required.includes(key) ? '' : '?'
            return `${key}${opt}: ${jsonSchemaPropertyToTs(prop)}`
          })
          paramSignature = `input: { ${inlineFields.join('; ')} }`
        }
        else {
          const fields = entries.map(([key, prop]) => {
            const opt = required.includes(key) ? '' : '?'
            const tsType = jsonSchemaPropertyToTs(prop)
            return `  ${key}${opt}: ${tsType};`
          })
          interfaceDecl = `interface ${typeName} {\n${fields.join('\n')}\n}`
          paramSignature = `input: ${typeName}`
        }
      }
    }
    catch {
      paramSignature = 'input: Record<string, unknown>'
    }
  }

  const desc = tool.description ? ` // ${tool.description}` : ''
  const methodSignature = `${sanitizedName}: (${paramSignature}) => Promise<unknown>;${desc}`

  return {
    originalName: name,
    sanitizedName,
    typeName,
    interfaceDecl,
    methodSignature,
  }
}

export interface GeneratedTypes {
  typeDefinitions: string
  toolNameMap: Map<string, string>
}

export function generateTypesFromTools(tools: McpToolDefinition[]): GeneratedTypes {
  const toolInfos = tools.map(generateToolTypeInfo)

  const interfaces = toolInfos
    .map(t => t.interfaceDecl)
    .filter(Boolean)
    .join('\n\n')

  const methods = toolInfos
    .map(t => `  ${t.methodSignature}`)
    .join('\n')

  const codemodeDecl = `declare const codemode: {\n${methods}\n};`

  const typeDefinitions = interfaces ? `${interfaces}\n\n${codemodeDecl}` : codemodeDecl

  const toolNameMap = new Map<string, string>()
  for (const info of toolInfos) {
    toolNameMap.set(info.sanitizedName, info.originalName)
  }

  return { typeDefinitions, toolNameMap }
}

export { sanitizeToolName }
