import { z } from 'zod'
import type { McpToolDefinition } from '../definitions/tools'
import { enrichNameTitle } from '../definitions/utils'
import { generateTypesFromTools, sanitizeToolName } from './types'
import { execute, type CodeModeOptions } from './executor'

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

/**
 * Wraps an array of tool definitions into a single "code" tool.
 * The LLM writes JavaScript that calls `codemode.*` methods,
 * which are executed in a secure V8 isolate via secure-exec.
 */
export function createCodemodeTools(
  tools: McpToolDefinition[],
  options?: CodeModeOptions,
): McpToolDefinition[] {
  const { typeDefinitions, toolNameMap } = generateTypesFromTools(tools)

  const description = CODE_TOOL_DESCRIPTION_TEMPLATE.replace('{{types}}', typeDefinitions)

  const codeTool: McpToolDefinition<{ code: z.ZodString }> = {
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
      const fns = buildDispatchFunctions(tools, toolNameMap)
      const result = await execute(code, fns, options)

      if (result.error) {
        const logOutput = result.logs.length > 0
          ? `\n\nConsole output:\n${result.logs.join('\n')}`
          : ''
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Execution error: ${result.error}${logOutput}` }],
        }
      }

      const logOutput = result.logs.length > 0
        ? `\n\nConsole output:\n${result.logs.join('\n')}`
        : ''

      let resultText: string
      if (result.result === undefined || result.result === null) {
        resultText = 'No return value.'
      }
      else if (typeof result.result === 'string') {
        resultText = result.result
      }
      else {
        try {
          resultText = JSON.stringify(result.result, null, 2)
        }
        catch {
          resultText = String(result.result)
        }
      }

      return {
        content: [{ type: 'text' as const, text: `${resultText}${logOutput}` }],
      }
    },
  }

  return [codeTool]
}

function buildDispatchFunctions(
  tools: McpToolDefinition[],
  toolNameMap: Map<string, string>,
): Record<string, (args: unknown) => Promise<unknown>> {
  const fns: Record<string, (args: unknown) => Promise<unknown>> = {}

  const toolsByName = new Map<string, McpToolDefinition>()
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
      const callToolResult = tool.inputSchema && Object.keys(tool.inputSchema).length > 0
        ? await (tool.handler as (args: unknown, extra: unknown) => Promise<unknown>)(args, {})
        : await (tool.handler as (extra: unknown) => Promise<unknown>)({})

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = callToolResult as any
      if (result?.content) {
        const textContent = result.content
          .filter((c: { type: string }) => c.type === 'text')
          .map((c: { text: string }) => c.text)
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
