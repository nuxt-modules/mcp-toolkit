import { z } from 'zod'
import type { McpToolDefinition, McpToolDefinitionListItem } from '../definitions/tools'
import { normalizeToolResult } from '../definitions/results'
import { enrichNameTitle } from '../definitions/utils'
import {
  generateTypesFromTools,
  generateToolCatalog,
  searchToolCatalog,
  formatSearchResults,
  sanitizeToolName,
  type ToolCatalogEntry,
} from './types'
import { execute, dispose, type CodeModeOptions } from './executor'

export type { CodeModeOptions }

const CODE_TOOL_DESCRIPTION_TEMPLATE = `Execute JavaScript to orchestrate multiple tool calls in a SINGLE invocation. ALWAYS combine ALL related operations into one code block — never split into separate calls.

Write the body of an async function. Use \`return\` to return the final result.

Available tools via the \`codemode\` object:
\`\`\`typescript
{{types}}
\`\`\`

IMPORTANT: Combine sequential, parallel, and conditional logic in ONE code block:
\`\`\`javascript
// Sequential: chain dependent calls
const data = await codemode.get_data({ id: "123" });
const result = await codemode.process({ input: data.value });

// Parallel: use Promise.all for independent calls
const [a, b, c] = await Promise.all([
  codemode.task({ name: "a" }),
  codemode.task({ name: "b" }),
  codemode.task({ name: "c" }),
]);

// Conditional + loops
for (const item of items) {
  if (item.active) await codemode.handle({ id: item.id });
}

return result;
\`\`\``

const PROGRESSIVE_CODE_DESCRIPTION_TEMPLATE = `Execute JavaScript to orchestrate tool calls in a SINGLE invocation. ALWAYS combine ALL related operations into one code block.

Write the body of an async function. Use \`return\` to return the final result.

{{count}} tools available via the \`codemode\` object. Use the \`search\` tool first to discover tool names and type signatures, then write code using \`codemode.toolName(input)\`.

IMPORTANT: Combine sequential, parallel, and conditional logic in ONE code block:
\`\`\`javascript
// Sequential
const data = await codemode.get_data({ id: "123" });
const result = await codemode.process({ input: data.value });

// Parallel
const [a, b] = await Promise.all([
  codemode.task_a(),
  codemode.task_b(),
]);

return result;
\`\`\``

const SEARCH_TOOL_DESCRIPTION = `Search available tools by keyword. Returns tool names, descriptions, and type signatures you can use with the \`code\` tool.

Use this to discover which \`codemode.*\` methods are available before writing code.`

function applyDescriptionTemplate(
  template: string,
  vars: { types?: string, count?: number },
): string {
  let result = template
  if (vars.types !== undefined) result = result.replace('{{types}}', vars.types)
  if (vars.count !== undefined) result = result.replaceAll('{{count}}', String(vars.count))
  return result
}

/**
 * Wraps an array of tool definitions into code mode tools.
 *
 * Standard mode: single `code` tool with all type definitions embedded.
 * Progressive mode (`progressive: true`): `search` + `code` tools — the LLM
 * discovers tool signatures via search, keeping the code tool lightweight.
 */
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

  const template = options?.description || CODE_TOOL_DESCRIPTION_TEMPLATE
  const description = applyDescriptionTemplate(template, {
    types: typeDefinitions,
    count: tools.length,
  })

  const fns = buildDispatchFunctions(tools, toolNameMap)
  const toolNames = [...toolNameMap.keys()]

  const codeTool = buildCodeTool(description, fns, toolNames, options)
  return [codeTool as McpToolDefinitionListItem]
}

function createProgressiveTools(
  tools: McpToolDefinitionListItem[],
  options?: CodeModeOptions,
): McpToolDefinitionListItem[] {
  const { entries, toolNameMap } = generateToolCatalog(tools)

  const template = options?.description || PROGRESSIVE_CODE_DESCRIPTION_TEMPLATE
  const description = applyDescriptionTemplate(template, { count: tools.length })

  const fns = buildDispatchFunctions(tools, toolNameMap)
  const toolNames = [...toolNameMap.keys()]

  const searchTool = buildSearchTool(entries)
  const codeTool = buildCodeTool(description, fns, toolNames, options)

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
  fns: Record<string, (args: unknown) => Promise<unknown>>,
  toolNames: string[],
  options?: CodeModeOptions,
): McpToolDefinition<{ code: z.ZodString }> {
  return {
    name: 'code',
    title: 'Code Mode',
    description,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      code: z.string().describe('JavaScript code to execute. Write the body of an async function.'),
    },
    handler: async ({ code }) => {
      const result = await execute(code, fns, options)
      const logSuffix = formatLogs(result.logs)

      if (result.error) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: formatError(result.error, code, toolNames, logSuffix) }],
        }
      }

      let resultText: string
      if (result.result === undefined || result.result === null) {
        resultText = 'No return value.'
      }
      else if (typeof result.result === 'string') {
        resultText = result.result
      }
      else {
        try {
          resultText = JSON.stringify(result.result)
        }
        catch {
          resultText = String(result.result)
        }
      }

      return {
        content: [{ type: 'text' as const, text: `${resultText}${logSuffix}` }],
      }
    },
  }
}

function formatLogs(logs: string[]): string {
  return logs.length > 0 ? `\n\nConsole output:\n${logs.join('\n')}` : ''
}

function formatError(error: string, code: string, toolNames: string[], logOutput: string): string {
  const codePreview = code.length > 500 ? `${code.slice(0, 500)}...` : code
  return `Execution error: ${error}

Code that failed:
\`\`\`javascript
${codePreview}
\`\`\`

Available tools: ${toolNames.join(', ')}
Fix the code and try again in a single combined block.${logOutput}`
}

function buildDispatchFunctions(
  tools: McpToolDefinitionListItem[],
  toolNameMap: Map<string, string>,
): Record<string, (args: unknown) => Promise<unknown>> {
  const fns: Record<string, (args: unknown) => Promise<unknown>> = {}

  const toolsByName = new Map<string, McpToolDefinitionListItem>()
  for (const tool of tools) {
    const { name } = enrichNameTitle({
      name: tool.name,
      title: tool.title,
      _meta: tool._meta,
      type: 'tool',
    })
    toolsByName.set(name, tool)
  }

  for (const [sanitized, original] of toolNameMap) {
    const tool = toolsByName.get(original)
    if (!tool) continue

    fns[sanitized] = async (input: unknown) => {
      const args = input ?? {}
      const rawResult = tool.inputSchema && Object.keys(tool.inputSchema).length > 0
        ? await (tool.handler as (args: unknown, extra: unknown) => Promise<unknown>)(args, {})
        : await (tool.handler as (extra: unknown) => Promise<unknown>)({})

      // Normalize string/number returns before code mode consumes them
      const result = normalizeToolResult(rawResult as Parameters<typeof normalizeToolResult>[0])

      if (result.content) {
        const textContent = result.content
          .filter((c): c is { type: 'text', text: string } => c.type === 'text')
          .map(c => c.text)
          .join('\n')

        try {
          return JSON.parse(textContent)
        }
        catch {
          return textContent
        }
      }

      return result
    }
  }

  return fns
}

/**
 * Check if a tool name needs sanitization for JavaScript
 */
export { sanitizeToolName }

/**
 * Dispose the code mode runtime and RPC server.
 * Call this during shutdown to release resources.
 */
export { dispose as disposeCodeMode }
