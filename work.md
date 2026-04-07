# Code Mode Integration — Combined Changeset

> Branch: `codex/codemode-integration`
> Base: `0bb110a` (main at time of fork)
> Files changed: 12 (+1,484 / -516 lines)

This document describes every change in this branch, why it was made, and how it was validated. The goal is a single consolidated PR that the module author can review with full context instead of piecemeal PRs.

---

## Table of Contents

1. [Per-Session RPC Architecture](#1-per-session-rpc-architecture)
2. [AsyncLocalStorage Context Preservation](#2-asynclocalstorage-context-preservation)
3. [Resource Limits & Abuse Prevention](#3-resource-limits--abuse-prevention)
4. [structuredContent Dispatch](#4-structuredcontent-dispatch)
5. [Tool Error Surfacing in Sandbox](#5-tool-error-surfacing-in-sandbox)
6. [Typed Output Schemas](#6-typed-output-schemas)
7. [Type Generation Improvements](#7-type-generation-improvements)
8. [Description Templates & Progressive Mode](#8-description-templates--progressive-mode)
9. [Structured Envelope Responses](#9-structured-envelope-responses)
10. [Handler Reuse Between Registration and Code Mode](#10-handler-reuse-between-registration-and-code-mode)
11. [Hardening Pass (PR Review Fixes)](#11-hardening-pass-pr-review-fixes)
12. [Test Coverage](#12-test-coverage)
13. [Documentation Updates](#13-documentation-updates)

---

## 1. Per-Session RPC Architecture

**Problem:** The original executor used a singleton RPC server and a singleton V8 runtime. All concurrent `execute()` calls shared the same `fns` map, `onReturn` callback, and RPC token. This meant:
- Concurrent executions could overwrite each other's dispatch functions
- A sandbox from execution A could call tools meant for execution B
- The `onReturn` callback was a single slot — racing executions would lose return values

**Solution:** Each `execute()` call now creates its own isolated RPC session:
- Fresh `createServer()` on port 0 (OS-assigned ephemeral port)
- Unique `execId` (8 random bytes) and `token` (32 random bytes) per execution
- `ExecutionContext` struct holds per-execution state: `fns`, `onReturn`, `deadlineMs`, `rpcCallCount`
- The `fns` map is frozen with `Object.freeze()` so sandbox code can't mutate it
- The sandbox sends `execId` in every RPC call; the server validates it matches the session
- `ActiveSession` tracking with cleanup on completion, error, or timeout

**Files:** `executor.ts` (complete rewrite of RPC layer)

---

## 2. AsyncLocalStorage Context Preservation

**Problem:** Nitro uses `AsyncLocalStorage` to carry per-request context (H3 event, auth, etc.). When Code Mode dispatches a tool call via HTTP RPC, the async context is lost — the RPC handler runs in the HTTP server's context, not the original request's.

**Solution:** On entry to `execute()`, we capture the current async context via `AsyncLocalStorage.snapshot()`. Every tool dispatch is wrapped through `restoreContext()`, which re-enters the original request's async context before calling the tool handler. This means tools called from sandbox code have access to the same `useEvent()`, auth state, etc. as if called directly.

A runtime check rejects Node.js < 18.16.0 where `snapshot()` is unavailable, returning a clear error message instead of crashing.

**Files:** `executor.ts` (lines 386-395, 437-448, 198, 216)

---

## 3. Resource Limits & Abuse Prevention

**Problem:** The original executor had no protection against:
- Oversized RPC request bodies (memory exhaustion)
- Infinite tool call loops
- Runaway wall-clock time (sandbox waiting forever on slow tools)
- Oversized tool responses

**Solution:** Added configurable limits with sensible defaults:

| Limit | Default | Config Key | Enforcement |
|-------|---------|------------|-------------|
| RPC request body | 1 MB | `maxRequestBodyBytes` | HTTP 413, streaming byte count |
| Tool calls per execution | 200 | `maxToolCalls` | HTTP 429, counter on `ExecutionContext` |
| Wall-clock timeout | 60s | `wallTimeLimitMs` | `setTimeout` → `runtime.dispose()` |
| Tool response size | 1 MB | `maxToolResponseSize` | Truncation (same strategy as `maxResultSize`) |

The wall-clock timeout is separate from the V8 CPU time limit. CPU time only counts isolate execution; wall time caps total elapsed time including host-side tool calls. On timeout, the runtime is forcefully disposed and the sandbox gets a clear error.

Error messages returned to sandbox/client are sanitized: file paths are replaced with `[path]`, stack traces are stripped, and messages are truncated to 500 chars. Full errors are logged server-side with `console.error('[nuxt-mcp-toolkit] ...')`.

**Files:** `executor.ts`, `types.ts` (new options), `8.code-mode.md` (docs)

---

## 4. structuredContent Dispatch

**Problem:** When a tool handler returned `structuredContent` (the MCP spec's typed data channel), Code Mode ignored it and fell through to extracting text from `content[].text`. This silently lost IDs, booleans, nested objects — breaking operation chaining where a returned ID is needed for follow-up calls.

**Solution:** `normalizeDispatchResult()` now checks `structuredContent` first:
1. If `rawResult.structuredContent != null` → return it directly (preserves typed data)
2. If `rawResult.isError` → convert to `CodeModeToolError` sentinel (see #5)
3. If `rawResult.content` has text items → return joined text (no JSON.parse — intentional, avoids ambiguity)
4. Plain objects/primitives pass through unchanged

The function also uses `isCallToolResult()` to distinguish MCP results from plain objects returned by handlers. This duck-type check was tightened: `isError` alone no longer matches unless it's a boolean (prevents false positives from objects that happen to have an `isError` property).

**Files:** `index.ts` (normalizeDispatchResult, extractTextContent), `results.ts` (isCallToolResult)

---

## 5. Tool Error Surfacing in Sandbox

**Problem:** Tool errors (`isError: true` results or thrown exceptions) were returned as plain strings to sandbox code, making them indistinguishable from successful results. `try/catch` never fired, and structured error details from `structuredContent` were lost.

**Solution:** Tool errors are now wrapped as a sentinel object with a namespaced key:

```ts
{
  __mcp_toolkit_error__: true,
  message: "Permission denied",
  tool: "delete_item",
  details: { /* structuredContent if available */ }
}
```

The sandbox proxy code detects this sentinel and throws a structured `Error` with `.tool`, `.isToolError`, and `.details` properties. This lets sandbox code use `try/catch` to handle tool errors with full context.

The sentinel key is namespaced (`__mcp_toolkit_error__`) rather than generic (`__toolError`) to avoid collisions with legitimate tool return values. Similarly, the stderr error prefix is `__MCP_EXEC_ERR__` rather than `__ERROR__`.

**Files:** `index.ts` (toToolError, CodeModeToolError), `executor.ts` (proxy boilerplate)

---

## 6. Typed Output Schemas

**Problem:** All Code Mode tools returned `Promise<unknown>` regardless of whether an `outputSchema` was defined. The LLM had no type information about what to expect back.

**Solution:** When a tool definition includes `outputSchema`, the type generator now emits typed return values:
- Small schemas (<=3 primitive fields) are inlined: `Promise<{ id: string; ok: boolean }>`
- Larger schemas get named interfaces: `Promise<GetReportOutput>`

This reuses the same `generateSchemaTypeInfo()` helper used for input schemas, extracted from the duplicated inline logic.

**Files:** `types.ts` (generateSchemaTypeInfo, generateToolTypeInfo output handling)

---

## 7. Type Generation Improvements

Several improvements to the TypeScript type generation for sandbox code:

- **Property key escaping:** Keys with special characters or reserved words are now properly quoted using `JSON.stringify()` via `formatTsPropertyKey()`. Before: `my-key?: string` (invalid TS). After: `"my-key"?: string`.
- **Enum value escaping:** Enum strings containing quotes or backslashes are now escaped with `JSON.stringify(v)` instead of template literals. Before: `"he said "hello""` (broken). After: `"he said \"hello\""`.
- **Name collision detection:** `buildToolNameMap()` now throws if two tools sanitize to the same name (e.g., `get-user` and `get_user` both become `get_user`), instead of silently overwriting.
- **Description stripping:** `declare const codemode` block no longer includes `// description` comments inline, keeping the type block clean. Descriptions remain in catalog signatures for progressive mode.

**Files:** `types.ts`

---

## 8. Description Templates & Progressive Mode

**Problem:** The code tool descriptions were overly verbose with multi-paragraph instructions about combining sequential/parallel/conditional logic. This wastes context window for every tool call.

**Solution:**
- Simplified templates to essential information: what the tool does, how to write code, available types
- Added `{{example}}` placeholder support alongside existing `{{types}}` and `{{count}}`
- Example blocks are automatically omitted when there are >10 tools (they become noise at that scale)
- Collapsed excessive newlines in template output
- Progressive mode gets its own concise example showing the search→code workflow

**Files:** `index.ts` (templates, applyDescriptionTemplate), `types.ts` (CodeModeOptions.description docs)

---

## 9. Structured Envelope Responses

**Problem:** The code tool returned only text content — no structured data for programmatic consumption by MCP clients.

**Solution:** The code tool now returns both `structuredContent` and `content`:

```ts
{
  isError: false,
  structuredContent: {
    ok: true,
    result: { id: "abc123" },
    durationMs: 142,
    logs: ["[stdout] Processing..."]
  },
  content: [{ type: "text", text: "..." }]  // human-readable fallback
}
```

- `CodeToolEnvelope` is a discriminated union (`ok: true | false`) preventing impossible states (simultaneous result + error)
- `ExecuteResult` is also a discriminated union — `result` and `error` are mutually exclusive at the type level
- `durationMs` tracks wall-clock execution time
- `outputSchema` is declared on the code tool definition so MCP clients can validate responses

**Files:** `index.ts` (CodeToolEnvelope, createCodeToolEnvelope, formatSuccessContent), `types.ts` (ExecuteResult)

---

## 10. Handler Reuse Between Registration and Code Mode

**Problem:** Code Mode reimplemented tool handler invocation: it manually resolved tool names, manually checked for `inputSchema`, and called handlers differently than `registerToolFromDefinition()`. This meant cache wrappers, error normalization, and future middleware would only apply to registered tools, not code mode dispatches.

**Solution:** Extracted shared utilities from `registerToolFromDefinition()`:
- `resolveToolDefinitionName(tool)` — applies `enrichNameTitle` to get the canonical name
- `createWrappedToolHandler(tool)` — applies cache wrappers and returns the handler
- `invokeWrappedToolHandler(tool, handler, input, extra)` — calls the handler with the correct argument shape (input+extra vs. extra-only based on whether `inputSchema` exists)

Code Mode now uses these same functions, so cache, auth, and any future middleware apply consistently whether a tool is called via MCP protocol or via sandbox code.

The `buildDispatchFunctions()` helper is now exported (used by tests) and accepts `McpRequestExtra`, which gets passed through to tool handlers so they have access to `requestId`, `signal`, `sendNotification`, etc.

**Files:** `tools.ts` (resolveToolDefinitionName, createWrappedToolHandler, invokeWrappedToolHandler), `index.ts` (buildDispatchEntries, buildDispatchFunctionsFromEntries)

---

## 11. Hardening Pass (PR Review Fixes)

After the feature work, a comprehensive PR review identified issues that were fixed:

### Error sentinel spoofability
Changed sentinel key from `__toolError` to `__mcp_toolkit_error__` and stderr prefix from `__ERROR__` to `__MCP_EXEC_ERR__` to avoid collisions with legitimate tool return values or user code logging.

### Empty catch blocks
Four truly empty `catch {}` blocks in cleanup paths (server.close, runtime.dispose, wall-timer dispose) now log warnings with `console.warn('[nuxt-mcp-toolkit] ...')` and context about which operation failed.

### Unhandled promise rejection
`void handleRpcRequest(...)` had no catch handler. If the inner try/catch failed AND `sendJson` also threw, the rejection escaped. Added `.catch(() => { if (!res.headersSent) res.destroy() })` as a safety net.

### Missing server-side error logging
The outer `catch` in `execute()` sanitized errors before returning them but never logged the raw error. Added `console.error('[nuxt-mcp-toolkit] Execution error:', error)` before sanitization so infrastructure errors are visible in server logs.

### isCallToolResult false positives
`isError` alone was enough to match `isCallToolResult()`. Now requires `typeof isError === 'boolean'` — objects with incidental string/number `isError` properties aren't misrouted.

### Dead proxy cache
`cachedProxyKey`/`cachedProxyCode` module-level variables never hit because each execution creates a new port+token. Removed entirely.

### Impossible type states
`ExecuteResult` was `{ result: unknown, error?: string }` — both could be set. Now a discriminated union where `result` and `error` are mutually exclusive. Same for `CodeToolEnvelope` with `ok` as discriminant.

### disposeCodeMode error swallowing
`.catch(() => {})` replaced with `.catch(error => console.warn(...))`.

**Files:** `executor.ts`, `index.ts`, `types.ts`, `results.ts`

---

## 12. Test Coverage

### codemode.test.ts (was ~180 lines, now ~380 lines)
- Type generation: declarations, output types, name collision detection
- Tool catalog: signatures, search formatting
- `createCodemodeTools`: standard mode, progressive mode, example block omission, outputSchema
- `buildDispatchFunctions`: structuredContent preference, plain text preservation, native object passthrough, thrown error → sentinel conversion, MCP extra propagation
- Code tool envelope: structured success/error responses
- `normalizeCode`: markdown fence stripping, arrow function unwrapping, export default removal
- `isCallToolResult`: content arrays, structuredContent, boolean isError, non-boolean isError rejection, plain object rejection
- Enum escaping: quotes, backslashes in enum values
- `isError` CallToolResult → tool error sentinel flow

### codemode-executor.test.ts (new, ~400 lines)
- Concurrency: parallel executions with no cross-talk
- RPC token validation: wrong token → 403
- Execution ID validation: wrong execId → 400
- Request body limits: oversized payload → 413
- Tool call quota: exceeding maxToolCalls → 429
- Tool response truncation: arrays, objects, primitives
- Wall-clock timeout behavior
- Cleanup verification after success/error/timeout

---

## 13. Documentation Updates

- `8.code-mode.md`: Added new config options (`maxRequestBodyBytes`, `maxToolResponseSize`, `wallTimeLimitMs`, `maxToolCalls`) to the configuration reference and resource limits table. Added "Error Sanitization" section. Added Node.js >=18.16.0 callout.
- `handlers.ts`: Expanded `experimental_codeMode` JSDoc with config keys and Node.js requirement.
- `2.installation.md`: Minor addition (context for secure-exec requirement).

---

## Files Changed Summary

| File | What changed |
|------|-------------|
| `executor.ts` | Rewritten: per-session RPC, AsyncLocalStorage, resource limits, error handling |
| `index.ts` | Rewritten: structuredContent dispatch, tool error sentinels, envelope responses, handler reuse |
| `types.ts` | Extended: output schemas, property key escaping, enum escaping, discriminated unions, new options |
| `results.ts` | Exported `isCallToolResult`, tightened `isError` check |
| `tools.ts` | Extracted `resolveToolDefinitionName`, `createWrappedToolHandler`, `invokeWrappedToolHandler` |
| `handlers.ts` | JSDoc update for `experimental_codeMode` |
| `executor.cloudflare.ts` | Re-export alignment |
| `codemode.test.ts` | Expanded from ~180 to ~380 lines |
| `codemode-executor.test.ts` | New: ~400 lines of executor integration tests |
| `8.code-mode.md` | New config options, resource limits table, error sanitization section |
| `2.installation.md` | Minor addition |
| `5.handlers.md` | Minor addition |
