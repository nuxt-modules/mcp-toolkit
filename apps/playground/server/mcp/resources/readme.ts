import { readFile } from 'node:fs/promises'

export default defineMcpResource({
  name: 'project-readme',
  uri: 'file:///README.md',
  mimeType: 'text/markdown',
  handler: () => readFile('README.md', 'utf8'),
})
