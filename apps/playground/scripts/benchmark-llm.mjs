/**
 * LLM Benchmark: Regular MCP vs Code Mode vs Progressive Code Mode
 *
 * Sends the same natural language tasks to a real LLM using all three modes
 * and compares actual token usage, round trips, and execution time.
 * Uses evlog for AI observability.
 *
 * Usage:
 *   AI_GATEWAY_API_KEY=xxx node apps/playground/scripts/benchmark-llm.mjs
 *   AI_GATEWAY_API_KEY=xxx BENCHMARK_MODEL=anthropic/claude-sonnet-4.5 node apps/playground/scripts/benchmark-llm.mjs
 *
 * Environment variables:
 *   AI_GATEWAY_API_KEY - Vercel AI Gateway key (required)
 *   BENCHMARK_MODEL    - Model to use (default: anthropic/claude-sonnet-4.6)
 *   MCP_BASE_URL       - Base URL (default: http://localhost:3000)
 *   API_KEY            - MCP API key (default: test-api-key-123)
 *
 * Requires the playground to be running.
 */

import { generateText, stepCountIs } from 'ai'
import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp'
import { createLogger, initLogger } from 'evlog'
import { createAILogger } from 'evlog/ai'

if (!process.env.AI_GATEWAY_API_KEY) {
  console.error('Error: AI_GATEWAY_API_KEY is required.')
  console.error('Get one at: https://vercel.com/docs/ai-gateway')
  process.exit(1)
}

const MODEL_ID = process.env.BENCHMARK_MODEL || 'anthropic/claude-sonnet-4.6'
const BASE_URL = process.env.MCP_BASE_URL || 'http://localhost:3000'
const API_KEY = process.env.API_KEY || 'test-api-key-123'

initLogger({
  drain: (ctx) => {
    if (ctx.event.ai) {
      console.log('\n  evlog wide event (ai):')
      console.log(`    model:     ${ctx.event.ai.model}`)
      console.log(`    provider:  ${ctx.event.ai.provider}`)
      console.log(`    calls:     ${ctx.event.ai.calls}`)
      if (ctx.event.ai.steps > 1) console.log(`    steps:     ${ctx.event.ai.steps}`)
      console.log(`    input:     ${ctx.event.ai.inputTokens} tokens`)
      console.log(`    output:    ${ctx.event.ai.outputTokens} tokens`)
      console.log(`    total:     ${ctx.event.ai.totalTokens} tokens`)
      if (ctx.event.ai.cacheReadTokens) console.log(`    cached:    ${ctx.event.ai.cacheReadTokens} tokens (read)`)
      if (ctx.event.ai.reasoningTokens) console.log(`    reasoning: ${ctx.event.ai.reasoningTokens} tokens`)
      if (ctx.event.ai.toolCalls?.length) console.log(`    tools:     ${ctx.event.ai.toolCalls.join(', ')}`)
      console.log(`    finish:    ${ctx.event.ai.finishReason}`)
    }
  },
})

const tasks = [
  {
    name: 'Single tool call',
    prompt: 'Say hello to "Alice"',
  },
  {
    name: 'Sequential chain',
    prompt: 'Calculate the BMI for someone who weighs 80kg and is 1.80m tall, then say hello to them with their BMI result in the greeting message.',
  },
  {
    name: 'Parallel (3 calls)',
    prompt: 'Say hello to Alice, Bob, and Charlie.',
  },
  {
    name: 'Parallel (5 calls)',
    prompt: 'Say hello to Alice, Bob, Charlie, Dave, and Eve.',
  },
  {
    name: 'Conditional logic',
    prompt: 'Calculate BMI for a person weighing 95kg at 1.70m height. If the BMI category is "Overweight" or "Obese", say hello with a message suggesting they exercise. Otherwise say hello with a congratulations message.',
  },
  {
    name: 'Batch + aggregate',
    prompt: 'Calculate the BMI for these 4 people: Alice (70kg, 1.65m), Bob (90kg, 1.80m), Charlie (110kg, 1.75m), Dave (60kg, 1.70m). Then say hello to each person with a personalized message that includes their BMI result and category. Return a summary of all results.',
  },
  {
    name: 'Loop + filter',
    prompt: 'Calculate the BMI for these people: Alice (55kg, 1.60m), Bob (120kg, 1.75m), Charlie (70kg, 1.80m), Dave (95kg, 1.65m), Eve (65kg, 1.70m). Only say hello to the ones whose BMI category is NOT "Normal weight" — include their BMI and a health tip in the greeting.',
  },
]

async function createMCP(path) {
  return createMCPClient({
    transport: {
      type: 'http',
      url: `${BASE_URL}${path}`,
      headers: { Authorization: `Bearer ${API_KEY}` },
    },
  })
}

const CODEMODE_SYSTEM = `You have a "code" tool that executes JavaScript in a sandbox. ALWAYS combine ALL operations into a SINGLE code tool call. Use Promise.all for parallel work, sequential awaits for dependent calls, loops for iteration, and conditionals for branching. Never make multiple separate code calls when one can do it all.`

const PROGRESSIVE_SYSTEM = `You have two tools: "search" to discover available tools, and "code" to execute JavaScript in a sandbox. First call search to find the tools you need, then combine ALL operations into a SINGLE code tool call. Use Promise.all for parallel work, sequential awaits for dependent calls, loops for iteration, and conditionals for branching.`

async function runTask(prompt, mcpClient, stepLimit, label, systemPrompt) {
  const tools = await mcpClient.tools()

  const log = createLogger({ task: label })
  const ai = createAILogger(log)
  const model = ai.wrap(MODEL_ID)

  const start = performance.now()

  const result = await generateText({
    model,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    prompt,
    tools,
    stopWhen: stepCountIs(stepLimit),
  })

  const durationMs = Math.round(performance.now() - start)

  log.set({ durationMs })
  log.emit()

  return {
    text: result.text,
    steps: result.steps.length,
    allToolCalls: result.steps.reduce((acc, s) => acc + (s.toolCalls?.length ?? 0), 0),
    usage: result.totalUsage,
    durationMs,
  }
}

function formatNumber(n) {
  if (n === undefined || n === null) return '-'
  return n.toLocaleString()
}

function pctDiff(base, value) {
  if (!base || !value) return '-'
  const pct = Math.round((1 - value / base) * 100)
  return `${pct > 0 ? '-' : '+'}${Math.abs(pct)}%`
}

async function run() {
  console.log(`\nProvider: AI Gateway`)
  console.log(`Model: ${MODEL_ID}`)
  console.log(`MCP Base URL: ${BASE_URL}\n`)

  const regularMcp = await createMCP('/mcp')
  const codemodeMcp = await createMCP('/mcp/codemode')
  const progressiveMcp = await createMCP('/mcp/codemode-progressive')

  const regularTools = await regularMcp.tools()
  const codemodeTools = await codemodeMcp.tools()
  const progressiveTools = await progressiveMcp.tools()

  console.log('═══════════════════════════════════════════════════════════════════════════════════')
  console.log('  TOOL DESCRIPTIONS SENT TO LLM')
  console.log('═══════════════════════════════════════════════════════════════════════════════════\n')

  const regularToolsJson = JSON.stringify(Object.values(regularTools).map(t => t.description))
  const codemodeToolsJson = JSON.stringify(Object.values(codemodeTools).map(t => t.description))
  const progressiveToolsJson = JSON.stringify(Object.values(progressiveTools).map(t => t.description))

  console.log(`  Regular mode:     ${Object.keys(regularTools).length} tools, ~${Math.ceil(regularToolsJson.length / 4)} tokens`)
  console.log(`  Code mode:        ${Object.keys(codemodeTools).length} tool,  ~${Math.ceil(codemodeToolsJson.length / 4)} tokens (${pctDiff(regularToolsJson.length, codemodeToolsJson.length)})`)
  console.log(`  Progressive mode: ${Object.keys(progressiveTools).length} tools, ~${Math.ceil(progressiveToolsJson.length / 4)} tokens (${pctDiff(regularToolsJson.length, progressiveToolsJson.length)})\n`)

  console.log('═══════════════════════════════════════════════════════════════════════════════════')
  console.log('  LLM BENCHMARK RESULTS')
  console.log('═══════════════════════════════════════════════════════════════════════════════════')

  const results = []

  for (const task of tasks) {
    console.log(`\n─── ${task.name} ───`)
    console.log(`  "${task.prompt}"`)

    let regular, codemode, progressive

    try {
      console.log('\n  [regular mode]')
      regular = await runTask(task.prompt, regularMcp, 10, `${task.name} (regular)`)
    }
    catch (err) {
      console.error(`  Regular mode failed: ${err.message}`)
      regular = null
    }

    try {
      console.log('\n  [code mode]')
      codemode = await runTask(task.prompt, codemodeMcp, 5, `${task.name} (code)`, CODEMODE_SYSTEM)
    }
    catch (err) {
      console.error(`  Code mode failed: ${err.message}`)
      codemode = null
    }

    try {
      console.log('\n  [progressive mode]')
      progressive = await runTask(task.prompt, progressiveMcp, 6, `${task.name} (progressive)`, PROGRESSIVE_SYSTEM)
    }
    catch (err) {
      console.error(`  Progressive mode failed: ${err.message}`)
      progressive = null
    }

    if (!regular) {
      console.log('  Skipping comparison (regular mode failed)')
      continue
    }

    const result = { task: task.name, regular, codemode, progressive }
    results.push(result)

    console.log('\n  Comparison:')
    const table = {
      'Steps (LLM rounds)': {
        Regular: regular.steps,
        ...(codemode ? { Code: codemode.steps } : {}),
        ...(progressive ? { Progressive: progressive.steps } : {}),
      },
      'Tool calls': {
        Regular: regular.allToolCalls,
        ...(codemode ? { Code: codemode.allToolCalls } : {}),
        ...(progressive ? { Progressive: progressive.allToolCalls } : {}),
      },
      'Input tokens': {
        Regular: formatNumber(regular.usage.inputTokens),
        ...(codemode ? { Code: `${formatNumber(codemode.usage.inputTokens)} (${pctDiff(regular.usage.inputTokens, codemode.usage.inputTokens)})` } : {}),
        ...(progressive ? { Progressive: `${formatNumber(progressive.usage.inputTokens)} (${pctDiff(regular.usage.inputTokens, progressive.usage.inputTokens)})` } : {}),
      },
      'Output tokens': {
        Regular: formatNumber(regular.usage.outputTokens),
        ...(codemode ? { Code: `${formatNumber(codemode.usage.outputTokens)} (${pctDiff(regular.usage.outputTokens, codemode.usage.outputTokens)})` } : {}),
        ...(progressive ? { Progressive: `${formatNumber(progressive.usage.outputTokens)} (${pctDiff(regular.usage.outputTokens, progressive.usage.outputTokens)})` } : {}),
      },
      'Total tokens': {
        Regular: formatNumber(regular.usage.totalTokens),
        ...(codemode ? { Code: `${formatNumber(codemode.usage.totalTokens)} (${pctDiff(regular.usage.totalTokens, codemode.usage.totalTokens)})` } : {}),
        ...(progressive ? { Progressive: `${formatNumber(progressive.usage.totalTokens)} (${pctDiff(regular.usage.totalTokens, progressive.usage.totalTokens)})` } : {}),
      },
      'Wall time (ms)': {
        Regular: regular.durationMs,
        ...(codemode ? { Code: codemode.durationMs } : {}),
        ...(progressive ? { Progressive: progressive.durationMs } : {}),
      },
    }
    console.table(table)
  }

  // ── Summary ─────────────────────────────────────────────────────
  if (results.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════════════════════════════')
    console.log('  SUMMARY')
    console.log('═══════════════════════════════════════════════════════════════════════════════════\n')

    const summaryRows = results.map((r) => {
      const row = {
        'Task': r.task,
        'Reg steps': r.regular.steps,
        'Reg tokens': formatNumber(r.regular.usage.totalTokens),
      }

      if (r.codemode) {
        row['Code steps'] = r.codemode.steps
        row['Code tokens'] = formatNumber(r.codemode.usage.totalTokens)
        row['Code savings'] = pctDiff(r.regular.usage.totalTokens, r.codemode.usage.totalTokens)
      }

      if (r.progressive) {
        row['Prog steps'] = r.progressive.steps
        row['Prog tokens'] = formatNumber(r.progressive.usage.totalTokens)
        row['Prog savings'] = pctDiff(r.regular.usage.totalTokens, r.progressive.usage.totalTokens)
      }

      return row
    })

    console.table(summaryRows)

    const totalRegular = results.reduce((a, r) => a + (r.regular.usage.totalTokens ?? 0), 0)
    const totalCode = results.reduce((a, r) => a + (r.codemode?.usage.totalTokens ?? 0), 0)
    const totalProg = results.reduce((a, r) => a + (r.progressive?.usage.totalTokens ?? 0), 0)

    console.log(`\n  Total tokens across all tasks:`)
    console.log(`    Regular:     ${formatNumber(totalRegular)}`)
    if (totalCode) console.log(`    Code Mode:   ${formatNumber(totalCode)} (${pctDiff(totalRegular, totalCode)})`)
    if (totalProg) console.log(`    Progressive: ${formatNumber(totalProg)} (${pctDiff(totalRegular, totalProg)})`)
    console.log()
  }

  await regularMcp.close()
  await codemodeMcp.close()
  await progressiveMcp.close()
}

run().catch((err) => {
  console.error('Benchmark failed:', err.message)
  process.exit(1)
})
