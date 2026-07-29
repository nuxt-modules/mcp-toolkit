import type { StandardSchemaWithJSON } from '@modelcontextprotocol/server'

const emptyObject = { type: 'object' as const, properties: {} }

/**
 * A Standard Schema describing "no arguments".
 *
 * Registering a prompt without an `argsSchema` makes the SDK invoke the
 * callback with a different arity than its own types declare, so an explicit
 * empty schema is passed instead — which is also what the argument-less prompt
 * advertises on the wire.
 *
 * @internal
 */
export const noArguments: StandardSchemaWithJSON<Record<string, never>> = {
  '~standard': {
    version: 1,
    vendor: 'nitro-mcp-toolkit',
    validate: () => ({ value: {} }),
    jsonSchema: {
      input: () => emptyObject,
      output: () => emptyObject,
    },
  },
}
