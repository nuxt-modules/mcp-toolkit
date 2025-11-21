import { defineMcpResource } from '../../../../../../src/runtime/server/types'

export default defineMcpResource({
  name: 'file_resource',
  file: 'test/fixtures/basic/test-file.txt',
  metadata: {
    description: 'A file resource',
  },
})
