import { readFile, readdir } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

export default defineMcpResource({
  name: 'file',
  uriTemplate: 'file:///project/{path}',
  list: async () => (await readdir(process.cwd(), { withFileTypes: true }))
    .filter(entry => entry.isFile() && !entry.name.startsWith('.'))
    .map(entry => ({ name: entry.name, uri: `file:///project/${encodeURIComponent(entry.name)}` })),
  handler: async (_uri, { path }) => {
    const root = process.cwd()
    const file = resolve(root, path)
    if (!file.startsWith(`${root}${sep}`) || path.startsWith('.')) throw new Error('File is outside the public project files.')
    return readFile(file, 'utf8')
  },
})
