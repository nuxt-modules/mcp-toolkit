import { toStandardJsonSchema } from '@valibot/to-json-schema'
import type { StandardJSONSchemaV1, StandardTypedV1 } from 'h3-mcp'
import type { GenericSchema } from 'valibot'

function hasJsonSchema(schema: StandardTypedV1): boolean {
  const standard = schema['~standard']
  if (!('jsonSchema' in standard)) return false
  return standard.jsonSchema !== null && typeof standard.jsonSchema === 'object'
}

function isValibotSchema(schema: StandardTypedV1): schema is GenericSchema {
  return schema['~standard'].vendor === 'valibot' && 'async' in schema && schema.async === false
}

function withTrimIgnored(converter: StandardJSONSchemaV1['~standard']['jsonSchema']) {
  const convert = (method: 'input' | 'output') => (options: StandardJSONSchemaV1.Options) =>
    converter[method]({
      ...options,
      libraryOptions: {
        ...options.libraryOptions,
        ignoreActions: ['trim'],
      },
    })

  return {
    input: convert('input'),
    output: convert('output'),
  }
}

export function resolveSchema(schema: StandardTypedV1 | undefined): StandardTypedV1 | undefined {
  if (!schema || !isValibotSchema(schema) || hasJsonSchema(schema)) return schema

  const resolved = toStandardJsonSchema(schema)
  const converted: StandardJSONSchemaV1 = {
    '~standard': {
      ...resolved['~standard'],
      jsonSchema: withTrimIgnored(resolved['~standard'].jsonSchema),
    },
  }
  return converted
}
