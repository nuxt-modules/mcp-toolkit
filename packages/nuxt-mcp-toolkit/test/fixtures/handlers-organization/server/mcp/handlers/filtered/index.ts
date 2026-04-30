import { defineMcpHandler, getMcpTools } from '../../../../../../../src/runtime/server/types'

export default defineMcpHandler({
  description: 'Filtered handler — exposes every tool tagged `searchable`, regardless of folder.',
  tools: event => getMcpTools({ event, tags: ['searchable'] }),
})
