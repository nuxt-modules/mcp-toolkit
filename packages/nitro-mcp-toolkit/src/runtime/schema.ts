import { toStandardJsonSchema } from '@valibot/to-json-schema'
import type { StandardJSONSchemaV1, StandardTypedV1 } from 'h3-mcp'
import type { GenericSchema } from 'valibot'

function isValibotSchema(schema: StandardTypedV1): schema is GenericSchema {
  return schema['~standard'].vendor === 'valibot' && 'async' in schema && schema.async === false
}

export function resolveSchema(schema: StandardTypedV1 | undefined): StandardTypedV1 | undefined {
  if (!schema || !isValibotSchema(schema)) return schema

  const standard = toStandardJsonSchema(schema)['~standard']
  const convert = (method: 'input' | 'output') => (options: StandardJSONSchemaV1.Options) =>
    standard.jsonSchema[method]({
      ...options,
      libraryOptions: {
        ...options.libraryOptions,
        ignoreActions: ['trim'],
      },
    })

  const converted: StandardJSONSchemaV1 = {
    '~standard': {
      ...standard,
      jsonSchema: {
        input: convert('input'),
        output: convert('output'),
      },
    },
  }
  return converted
}
