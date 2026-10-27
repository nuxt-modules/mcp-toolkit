import { readFile } from 'node:fs/promises'

export default defineMcpResource({
  name: 'project-package',
  uri: 'file:///package.json',
  mimeType: 'application/json',
  handler: () => readFile('package.json', 'utf8'),
})
