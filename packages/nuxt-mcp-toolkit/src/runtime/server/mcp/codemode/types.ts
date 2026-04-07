import { z, type ZodRawShape } from 'zod'
import type { McpToolDefinition, McpToolDefinitionListItem } from '../definitions/tools'
import { enrichNameTitle } from '../definitions/utils'

export interface CodeModeOptions {
  /** V8 isolate memory limit in MB. Default: 64 */
  memoryLimit?: number
  /** CPU time limit per execution in ms. Default: 10000 */
  cpuTimeLimitMs?: number
  /** Max result size in bytes before truncation. Default: 102400 (100KB) */
  maxResultSize?: number
  /**
   * Max bytes accepted in a single RPC request body from the sandbox. Default: 1_048_576 (1MB).
   * Applied when the Code Mode RPC server first starts; later values are ignored until `disposeCodeMode()`.
   */
  maxRequestBodyBytes?: number
  /** Max bytes for a single tool RPC response before truncation. Default: 1_048_576 (1MB) */
  maxToolResponseSize?: number
  /**
   * Deadline for each execution (epoch-based). Checked at the start of every sandbox→host RPC request.
   * After it passes, the next tool or return RPC gets HTTP 408. Pure isolate CPU time is still capped by `cpuTimeLimitMs`.
   * Default: 60_000 (60s)
   */
  wallTimeLimitMs?: number
  /** Max tool RPC calls per execution. Default: 200 */
  maxToolCalls?: number
  /**
   * Enable progressive disclosure: exposes a `search` tool for discovering
   * available tools, keeping the `code` tool description lightweight.
   * Recommended when the server exposes many tools (50+).
   */
  progressive?: boolean
  /**
   * Custom description template for the `code` tool.
   * Supports placeholders: `{{types}}` (type definitions), `{{count}}` (tool count).
   */
  description?: string
}

export interface ExecuteResult {
  result: unknown
  error?: string
  logs: string[]
}

const RESERVED_WORDS = new Set([
  'break', 'case', 'catch', 'continue', 'debugger', 'default', 'delete', 'do',
  'else', 'finally', 'for', 'function', 'if', 'in', 'instanceof', 'new',
  'return', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while',
  'with', 'class', 'const', 'enum', 'export', 'extends', 'import', 'super',
  'implements', 'interface', 'let', 'package', 'private', 'protected', 'public',
  'static', 'yield', 'await', 'async',
])

function sanitizeToolName(name: string): string {
  let sanitized = name.replace(/[^\w$]/g, '_')
  if (/^\d/.test(sanitized)) sanitized = `_${sanitized}`
  if (RESERVED_WORDS.has(sanitized)) sanitized = `${sanitized}_`
  return sanitized
}

function pascalCase(str: string): string {
  return str.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase())
}

function formatTsPropertyKey(key: string): string {
  return /^[A-Z_$][\w$]*$/i.test(key) && !RESERVED_WORDS.has(key)
    ? key
    : JSON.stringify(key)
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

interface SchemaTypeInfo {
  interfaceDecl: string | null
  typeExpression: string
}

function generateSchemaTypeInfo(
  schema: ZodRawShape,
  typeName: string,
): SchemaTypeInfo | null {
  const jsonSchema = z.toJSONSchema(z.object(schema))
  const properties = jsonSchema.properties as Record<string, Record<string, unknown>> | undefined
  const required = (jsonSchema.required as string[]) || []

  if (!properties || Object.keys(properties).length === 0) {
    return null
  }

  const entries = Object.entries(properties)
  const allPrimitive = entries.every(([, prop]) => isPrimitiveProp(prop))

  if (entries.length <= INLINE_THRESHOLD && allPrimitive) {
    const inlineFields = entries.map(([key, prop]) => {
      const opt = required.includes(key) ? '' : '?'
      return `${formatTsPropertyKey(key)}${opt}: ${jsonSchemaPropertyToTs(prop)}`
    })

    return {
      interfaceDecl: null,
      typeExpression: `{ ${inlineFields.join('; ')} }`,
    }
  }

  const fields = entries.map(([key, prop]) => {
    const opt = required.includes(key) ? '' : '?'
    const tsType = jsonSchemaPropertyToTs(prop)
    return `  ${formatTsPropertyKey(key)}${opt}: ${tsType};`
  })

  return {
    interfaceDecl: `interface ${typeName} {\n${fields.join('\n')}\n}`,
    typeExpression: typeName,
  }
}

interface ToolTypeInfo {
  originalName: string
  sanitizedName: string
  typeName: string
  interfaceDecl: string | null
  outputInterfaceDecl: string | null
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
      const schemaTypeInfo = generateSchemaTypeInfo(tool.inputSchema, typeName)
      if (schemaTypeInfo) {
        interfaceDecl = schemaTypeInfo.interfaceDecl
        paramSignature = `input: ${schemaTypeInfo.typeExpression}`
      }
    }
    catch {
      paramSignature = 'input: Record<string, unknown>'
    }
  }

  // Generate output type from outputSchema
  let outputInterfaceDecl: string | null = null
  let returnType = 'unknown'
  const outputTypeName = `${pascalCase(sanitizedName)}Output`

  if (tool.outputSchema && Object.keys(tool.outputSchema).length > 0) {
    try {
      const schemaTypeInfo = generateSchemaTypeInfo(tool.outputSchema, outputTypeName)
      if (schemaTypeInfo) {
        outputInterfaceDecl = schemaTypeInfo.interfaceDecl
        returnType = schemaTypeInfo.typeExpression
      }
    }
    catch {
      // Fall through to default Promise<unknown>
    }
  }

  const desc = tool.description ? ` // ${tool.description}` : ''
  const methodSignature = `${sanitizedName}: (${paramSignature}) => Promise<${returnType}>;${desc}`

  return {
    originalName: name,
    sanitizedName,
    typeName,
    interfaceDecl,
    outputInterfaceDecl,
    methodSignature,
  }
}

function buildToolNameMap(infos: ToolTypeInfo[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const info of infos) {
    map.set(info.sanitizedName, info.originalName)
  }
  return map
}

export interface GeneratedTypes {
  typeDefinitions: string
  toolNameMap: Map<string, string>
}

export function generateTypesFromTools(tools: McpToolDefinitionListItem[]): GeneratedTypes {
  const toolInfos = tools.map(generateToolTypeInfo)

  const interfaces = toolInfos
    .flatMap(t => [t.interfaceDecl, t.outputInterfaceDecl])
    .filter(Boolean)
    .join('\n\n')

  const methods = toolInfos
    .map(t => `  ${t.methodSignature}`)
    .join('\n')

  const codemodeDecl = `declare const codemode: {\n${methods}\n};`

  const typeDefinitions = interfaces ? `${interfaces}\n\n${codemodeDecl}` : codemodeDecl

  return { typeDefinitions, toolNameMap: buildToolNameMap(toolInfos) }
}

export interface ToolCatalogEntry {
  name: string
  originalName: string
  description: string
  signature: string
  interfaceDecl?: string
}

export function generateToolCatalog(tools: McpToolDefinitionListItem[]): {
  entries: ToolCatalogEntry[]
  toolNameMap: Map<string, string>
} {
  const toolInfos = tools.map((tool) => {
    const info = generateToolTypeInfo(tool)
    return { ...info, description: tool.description || '' }
  })

  const entries: ToolCatalogEntry[] = toolInfos.map(info => ({
    name: info.sanitizedName,
    originalName: info.originalName,
    description: info.description,
    signature: info.methodSignature,
    interfaceDecl: [info.interfaceDecl, info.outputInterfaceDecl].filter(Boolean).join('\n\n') || undefined,
  }))

  return { entries, toolNameMap: buildToolNameMap(toolInfos) }
}

export function searchToolCatalog(entries: ToolCatalogEntry[], query: string): ToolCatalogEntry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return entries

  const scored: { entry: ToolCatalogEntry, score: number }[] = []

  for (const entry of entries) {
    const nameLower = entry.name.toLowerCase()
    const originalLower = entry.originalName.toLowerCase()
    const descLower = entry.description.toLowerCase()
    const allText = `${nameLower} ${originalLower} ${descLower}`

    if (!terms.every(t => allText.includes(t))) continue

    let score = 0
    for (const term of terms) {
      if (nameLower === term || originalLower === term) score += 10
      else if (nameLower.startsWith(term) || originalLower.startsWith(term)) score += 5
      else if (nameLower.includes(term) || originalLower.includes(term)) score += 3
      else if (descLower.includes(term)) score += 1
    }

    scored.push({ entry, score })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.map(s => s.entry)
}

export function formatSearchResults(matches: ToolCatalogEntry[], query: string, total: number): string {
  if (matches.length === 0) {
    return `No tools found matching "${query}". ${total} tools available — try a broader query.`
  }

  const lines = matches.map((m) => {
    const sig = m.interfaceDecl
      ? `${m.interfaceDecl}\n\ncodemode.${m.signature}`
      : `codemode.${m.signature}`
    return sig
  })

  const header = matches.length === total
    ? `All ${total} tools:`
    : `Found ${matches.length}/${total} tools matching "${query}":`

  return `${header}\n\n${lines.join('\n\n')}`
}

export { sanitizeToolName }
