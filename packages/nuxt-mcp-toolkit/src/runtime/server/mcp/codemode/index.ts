import { z } from 'zod'
import type { McpRequestExtra } from '../definitions/sdk-extra'
import {
  type McpToolDefinition,
  type McpToolDefinitionListItem,
  createWrappedToolHandler,
  invokeWrappedToolHandler,
  normalizeErrorToResult,
  resolveToolDefinitionName,
} from '../definitions/tools'
import { isCallToolResult } from '../definitions/results'
import {
  formatSearchResults,
  generateToolCatalog,
  generateTypesFromTools,
  sanitizeToolName,
  searchToolCatalog,
  type CodeModeOptions,
  type ExecuteResult,
  type ToolCatalogEntry,
} from './types'

export type { CodeModeOptions }

interface CodeModeToolError {
  __mcp_toolkit_error__: true
  message: string
  tool: string
  details?: unknown
}

type CodeToolEnvelope
  = | { ok: true, result?: unknown, error?: undefined, logs?: string[], durationMs: number }
    | { ok: false, result?: undefined, error: string, logs?: string[], durationMs: number }

interface DispatchToolEntry {
  originalName: string
  sanitizedName: string
  tool: McpToolDefinitionListItem
  handler: (...args: unknown[]) => unknown
}

const CODE_TOOL_OUTPUT_SCHEMA = {
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().optional(),
  logs: z.array(z.string()).optional(),
  durationMs: z.number(),
}

async function runExecute(
  code: string,
  fns: Record<string, (args: unknown) => Promise<unknown>>,
  options?: CodeModeOptions,
) {
  const { execute } = await import('./executor')
  return execute(code, fns, options)
}

const CODE_TOOL_DESCRIPTION_TEMPLATE = `Execute JavaScript to orchestrate tool calls in one invocation.

Write the body of an async function and use \`return\` for the final value.

Available via the \`codemode\` object:
\`\`\`typescript
{{types}}
\`\`\`{{example}}`

const PROGRESSIVE_CODE_DESCRIPTION_TEMPLATE = `Execute JavaScript to orchestrate tool calls in one invocation.

Write the body of an async function and use \`return\` for the final value.

{{count}} tools are available via the \`codemode\` object. Use the \`search\` tool to find names and signatures before writing code.{{example}}`

const STANDARD_CODE_EXAMPLE_FALLBACK = `

Example:
\`\`\`javascript
const data = await codemode.get_data({ id: "123" });
const result = await codemode.process({ input: data.value });
return result;
\`\`\``

const PROGRESSIVE_CODE_EXAMPLE_FALLBACK = `

Example:
\`\`\`javascript
// After using the search tool to find the right method names:
const user = await codemode.get_user({ id: "123" });
return user;
\`\`\``

const SEARCH_TOOL_DESCRIPTION = `Search available tools by keyword. Returns tool names, descriptions, and type signatures you can use with the \`code\` tool.

Use this to discover which \`codemode.*\` methods are available before writing code.`

const MAX_TOOLS_WITH_EXAMPLE_BLOCK = 10

function applyDescriptionTemplate(
  template: string,
  vars: { types?: string, count?: number, example?: string },
): string {
  let result = template
  if (vars.types !== undefined) result = result.replace('{{types}}', vars.types)
  if (vars.count !== undefined) result = result.replaceAll('{{count}}', String(vars.count))
  result = result.replace('{{example}}', vars.example ?? '')
  return result.replace(/\n{3,}/g, '\n\n').trim()
}

export function createCodemodeTools(
  tools: McpToolDefinitionListItem[],
  options?: CodeModeOptions,
): McpToolDefinitionListItem[] {
  if (options?.progressive) {
    return createProgressiveTools(tools, options)
  }
  return createStandardTools(tools, options)
}

function createStandardTools(
  tools: McpToolDefinitionListItem[],
  options?: CodeModeOptions,
): McpToolDefinitionListItem[] {
  const { typeDefinitions, toolNameMap } = generateTypesFromTools(tools)
  const dispatchEntries = buildDispatchEntries(tools, toolNameMap)

  const example = tools.length > MAX_TOOLS_WITH_EXAMPLE_BLOCK
    ? ''
    : STANDARD_CODE_EXAMPLE_FALLBACK

  const template = options?.description || CODE_TOOL_DESCRIPTION_TEMPLATE
  const description = applyDescriptionTemplate(template, {
    types: typeDefinitions,
    count: tools.length,
    example,
  })

  const codeTool = buildCodeTool(description, dispatchEntries, options)
  return [codeTool as McpToolDefinitionListItem]
}

function createProgressiveTools(
  tools: McpToolDefinitionListItem[],
  options?: CodeModeOptions,
): McpToolDefinitionListItem[] {
  const { entries, toolNameMap } = generateToolCatalog(tools)
  const dispatchEntries = buildDispatchEntries(tools, toolNameMap)

  const example = tools.length > MAX_TOOLS_WITH_EXAMPLE_BLOCK
    ? ''
    : PROGRESSIVE_CODE_EXAMPLE_FALLBACK

  const template = options?.description || PROGRESSIVE_CODE_DESCRIPTION_TEMPLATE
  const description = applyDescriptionTemplate(template, {
    count: tools.length,
    example,
  })

  const searchTool = buildSearchTool(entries)
  const codeTool = buildCodeTool(description, dispatchEntries, options)

  return [searchTool as McpToolDefinitionListItem, codeTool as McpToolDefinitionListItem]
}

function buildSearchTool(
  entries: ToolCatalogEntry[],
): McpToolDefinition<{ query: z.ZodString }> {
  return {
    name: 'search',
    title: 'Search Tools',
    description: SEARCH_TOOL_DESCRIPTION,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      query: z.string().describe('Keywords to search for (e.g. "user", "list", "create todo")'),
    },
    handler: async ({ query }) => {
      const matches = searchToolCatalog(entries, query)
      const text = formatSearchResults(matches, query, entries.length)
      return { content: [{ type: 'text' as const, text }] }
    },
  }
}

function buildCodeTool(
  description: string,
  dispatchEntries: DispatchToolEntry[],
  options?: CodeModeOptions,
): McpToolDefinition<{ code: z.ZodString }, typeof CODE_TOOL_OUTPUT_SCHEMA> {
  const toolNames = dispatchEntries.map(entry => entry.sanitizedName)

  return {
    name: 'code',
    title: 'Code Mode',
    description,
    outputSchema: CODE_TOOL_OUTPUT_SCHEMA,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      code: z.string().describe('JavaScript code to execute. Write the body of an async function.'),
    },
    handler: async ({ code }, extra) => {
      const fns = buildDispatchFunctionsFromEntries(dispatchEntries, extra)
      const executeResult = await runExecute(code, fns, options)
      const envelope = createCodeToolEnvelope(executeResult)

      return {
        isError: !envelope.ok,
        structuredContent: envelope,
        content: [{
          type: 'text' as const,
          text: envelope.ok
            ? formatSuccessContent(envelope)
            : formatError(envelope.error ?? 'Execution failed', code, toolNames, envelope.logs ?? []),
        }],
      }
    },
  }
}

function buildDispatchEntries(
  tools: McpToolDefinitionListItem[],
  toolNameMap: Map<string, string>,
): DispatchToolEntry[] {
  const toolsByName = new Map<string, McpToolDefinitionListItem>()
  for (const tool of tools) {
    toolsByName.set(resolveToolDefinitionName(tool), tool)
  }

  const entries: DispatchToolEntry[] = []
  for (const [sanitizedName, originalName] of toolNameMap) {
    const tool = toolsByName.get(originalName)
    if (!tool) continue

    entries.push({
      originalName,
      sanitizedName,
      tool,
      handler: createWrappedToolHandler(tool),
    })
  }

  return entries
}

function buildDispatchFunctionsFromEntries(
  entries: DispatchToolEntry[],
  extra: McpRequestExtra,
): Record<string, (args: unknown) => Promise<unknown>> {
  const fns: Record<string, (args: unknown) => Promise<unknown>> = {}

  for (const entry of entries) {
    fns[entry.sanitizedName] = async (input: unknown) => {
      let rawResult: unknown

      try {
        rawResult = await invokeWrappedToolHandler(entry.tool, entry.handler, input, extra)
      }
      catch (error) {
        rawResult = normalizeErrorToResult(error)
      }

      return normalizeDispatchResult(rawResult, entry.sanitizedName)
    }
  }

  return fns
}

function extractTextContent(result: { content?: Array<{ type: string, text?: string }> }): string | undefined {
  const textContent = result.content
    ?.filter((item): item is { type: 'text', text: string } => item.type === 'text' && typeof item.text === 'string')
    .map(item => item.text)
    .join('\n')

  return textContent && textContent.length > 0 ? textContent : undefined
}

function toToolError(result: { content?: Array<{ type: string, text?: string }>, structuredContent?: unknown }, tool: string): CodeModeToolError {
  return {
    __mcp_toolkit_error__: true,
    message: extractTextContent(result)
      ?? (result.structuredContent !== undefined ? JSON.stringify(result.structuredContent) : 'Tool execution failed'),
    tool,
    details: result.structuredContent,
  }
}

function normalizeDispatchResult(rawResult: unknown, tool: string): unknown {
  if (rawResult == null) {
    return rawResult
  }

  if (
    typeof rawResult === 'string'
    || typeof rawResult === 'number'
    || typeof rawResult === 'boolean'
    || Array.isArray(rawResult)
  ) {
    return rawResult
  }

  if (typeof rawResult === 'object') {
    if (!isCallToolResult(rawResult)) {
      return rawResult
    }

    if (rawResult.isError) {
      return toToolError(rawResult, tool)
    }

    if (rawResult.structuredContent != null) {
      return rawResult.structuredContent
    }

    const textContent = extractTextContent(rawResult)
    if (textContent !== undefined) {
      return textContent
    }
  }

  return rawResult
}

function createCodeToolEnvelope(result: ExecuteResult): CodeToolEnvelope {
  const logs = result.logs.length > 0 ? result.logs : undefined

  if (result.error) {
    return { ok: false, error: result.error, logs, durationMs: result.durationMs }
  }

  const envelope: CodeToolEnvelope = { ok: true, durationMs: result.durationMs, logs }
  if (result.result !== undefined) {
    envelope.result = result.result
  }
  return envelope
}

function formatSuccessContent(envelope: CodeToolEnvelope): string {
  let resultText = 'No return value.'

  if (envelope.result !== undefined && envelope.result !== null) {
    if (typeof envelope.result === 'string') {
      resultText = envelope.result
    }
    else {
      try {
        resultText = JSON.stringify(envelope.result)
      }
      catch {
        resultText = String(envelope.result)
      }
    }
  }

  const logSuffix = formatLogs(envelope.logs ?? [])
  return `${resultText}${logSuffix}`
}

function formatLogs(logs: string[]): string {
  return logs.length > 0 ? `\n\nConsole output:\n${logs.join('\n')}` : ''
}

function formatError(error: string, code: string, toolNames: string[], logs: string[]): string {
  const codePreview = code.length > 500 ? `${code.slice(0, 500)}...` : code
  return `Execution error: ${error}

Code that failed:
\`\`\`javascript
${codePreview}
\`\`\`

Available tools: ${toolNames.join(', ')}
Fix the code and try again in a single combined block.${formatLogs(logs)}`
}

export function buildDispatchFunctions(
  tools: McpToolDefinitionListItem[],
  toolNameMap: Map<string, string>,
  extra: McpRequestExtra,
): Record<string, (args: unknown) => Promise<unknown>> {
  return buildDispatchFunctionsFromEntries(buildDispatchEntries(tools, toolNameMap), extra)
}

export { sanitizeToolName }

export function disposeCodeMode(): void {
  void import('./executor')
    .then(m => m.dispose())
    .catch(error => console.warn('[nuxt-mcp-toolkit] disposeCodeMode failed:', error))
}
