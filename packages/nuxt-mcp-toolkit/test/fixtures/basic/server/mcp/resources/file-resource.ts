import { useStorage } from 'nitropack/runtime'
import { defineMcpResource } from '../../../../../../src/runtime/server/index'

export default defineMcpResource({
  name: 'file_resource',
  uri: 'file:///test-file.txt',
  description: 'A bundled file resource',
  handler: async () => {
    const text = await useStorage('assets:server').getItem<string>('test-file.txt')
    if (text === null) throw new Error('The bundled test file is missing.')
    return text
  },
})
