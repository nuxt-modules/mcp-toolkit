const endpoint = new URL('/mcp', location.href).href

const PROTOCOL = { modern: '2026-07-28', legacy: '2025-11-25' }
const ENVELOPE = 'io.modelcontextprotocol/'

const state = { era: 'modern', entries: [], selected: null, wire: null }
let nextId = 0

const el = {
  server: document.querySelector('.server'),
  eras: document.querySelector('.eras'),
  nav: document.querySelector('nav'),
  detail: document.querySelector('section'),
}

/**
 * The two protocol revisions differ enough on the wire to be worth showing side
 * by side: modern is stateless JSON carrying a `_meta` envelope plus headers
 * mirroring the body, legacy is a bare request answered as an SSE stream.
 */
async function rpc(method, params = {}) {
  const modern = state.era === 'modern'
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': PROTOCOL[state.era],
  }

  const body = { jsonrpc: '2.0', id: ++nextId, method, params: { ...params } }

  if (modern) {
    headers['mcp-method'] = method
    const target = params.name ?? params.uri
    if (target) headers['mcp-name'] = target
    body.params._meta = {
      [`${ENVELOPE}protocolVersion`]: PROTOCOL.modern,
      [`${ENVELOPE}clientCapabilities`]: {},
    }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const payload = decode(await response.text())
  state.wire = { request: body, response: payload }

  if (payload.error) {
    const error = new Error(payload.error.message)
    error.data = payload.error.data
    throw error
  }

  return payload.result
}

/** Legacy replies arrive as `text/event-stream`, modern ones as plain JSON. */
function decode(text) {
  const data = text
    .split('\n')
    .find((line) => line.startsWith('data:'))
    ?.slice('data:'.length)

  return JSON.parse(data ?? text)
}

/** Server metadata lives in `server/discover` on modern, `initialize` on legacy. */
async function describe() {
  if (state.era === 'legacy') {
    const result = await rpc('initialize', {
      protocolVersion: PROTOCOL.legacy,
      capabilities: {},
      clientInfo: { name: 'inspector', version: '0' },
    })
    return result.serverInfo
  }

  const result = await rpc('server/discover')
  return result._meta?.[`${ENVELOPE}serverInfo`]
}

async function load() {
  el.nav.innerHTML = '<p class="empty">Loading…</p>'

  try {
    const server = await describe()
    const [tools, resources, templates, prompts] = await Promise.all([
      rpc('tools/list'),
      rpc('resources/list'),
      rpc('resources/templates/list'),
      rpc('prompts/list'),
    ])

    renderServer(server)

    state.entries = [
      ...tools.tools.map((tool) => ({
        kind: 'tool',
        name: tool.name,
        detail: tool.description,
        schema: tool.inputSchema,
      })),
      ...resources.resources.map((resource) => ({
        kind: 'resource',
        name: resource.name,
        detail: resource.uri,
        uri: resource.uri,
      })),
      ...templates.resourceTemplates.map((template) => ({
        kind: 'template',
        name: template.name,
        detail: template.uriTemplate,
        uriTemplate: template.uriTemplate,
      })),
      ...prompts.prompts.map((prompt) => ({
        kind: 'prompt',
        name: prompt.name,
        detail: prompt.description,
        args: prompt.arguments ?? [],
      })),
    ]
  } catch (error) {
    el.nav.innerHTML = ''
    el.detail.innerHTML = ''
    el.detail.append(heading('Cannot reach the server'), failure(error))
    return
  }

  const [kind, name] = location.hash.replace('#', '').split('/')
  const wanted = state.selected ?? { kind, name }
  state.selected =
    state.entries.find((entry) => entry.kind === wanted.kind && entry.name === wanted.name) ??
    state.entries[0]

  select(state.selected)
}

/** Editing the hash, or going back, should move the selection with it. */
addEventListener('hashchange', () => {
  const [kind, name] = location.hash.slice(1).split('/')
  const entry = state.entries.find((item) => item.kind === kind && item.name === name)
  if (entry && entry !== state.selected) select(entry)
})

/** The hash keeps a definition addressable, so a reload lands back on it. */
function select(entry) {
  state.selected = entry
  state.wire = null
  if (entry) location.hash = `${entry.kind}/${entry.name}`
  renderNav()
  renderDetail()
}

/* Rendering */

const LABELS = {
  tool: 'Tools',
  resource: 'Resources',
  template: 'Templates',
  prompt: 'Prompts',
}

/** Whatever the server advertises about itself: its icon, its name, its site. */
function renderServer(server) {
  el.server.innerHTML = ''
  if (!server) return

  const icon = server.icons?.[0]
  if (icon) {
    el.server.append(Object.assign(document.createElement('img'), { src: icon.src, alt: '' }))
  }

  const label = `${server.name}@${server.version}`

  el.server.append(
    server.websiteUrl
      ? Object.assign(document.createElement('a'), { href: server.websiteUrl, textContent: label })
      : document.createTextNode(label),
  )
}

function renderNav() {
  el.nav.innerHTML = ''

  for (const [kind, label] of Object.entries(LABELS)) {
    const entries = state.entries.filter((entry) => entry.kind === kind)
    if (entries.length === 0) continue

    el.nav.append(Object.assign(document.createElement('h2'), { textContent: label }))

    for (const entry of entries) {
      const button = document.createElement('button')
      button.append(document.createTextNode(entry.name))
      if (entry.detail) {
        button.append(Object.assign(document.createElement('small'), { textContent: entry.detail }))
      }
      button.ariaCurrent = String(entry === state.selected)
      button.onclick = () => select(entry)
      el.nav.append(button)
    }
  }
}

function heading(text) {
  return Object.assign(document.createElement('h2'), { textContent: text })
}

function renderDetail() {
  const entry = state.selected
  el.detail.innerHTML = ''

  if (!entry) {
    el.detail.append(heading('Nothing registered'))
    return
  }

  el.detail.append(heading(entry.name))
  if (entry.detail) {
    el.detail.append(Object.assign(document.createElement('p'), { textContent: entry.detail }))
  }

  const output = document.createElement('div')
  output.className = 'output'

  const form = document.createElement('form')
  const fields = buildFields(entry)
  form.append(...fields.map((field) => field.node))

  const run = document.createElement('button')
  run.className = 'run'
  run.textContent = entry.kind === 'prompt' ? 'Render' : entry.kind === 'tool' ? 'Call' : 'Read'
  form.append(run)

  form.onsubmit = async (event) => {
    event.preventDefault()
    run.disabled = true
    output.innerHTML = ''

    try {
      output.append(...present(await invoke(entry, fields)))
    } catch (error) {
      output.append(failure(error))
    } finally {
      run.disabled = false
      output.append(wirePanel())
    }
  }

  el.detail.append(form, output)
}

/** MCP describes tool inputs as JSON Schema and prompt inputs as an argument list. */
function buildFields(entry) {
  if (entry.kind === 'tool') {
    const schema = entry.schema ?? {}
    const required = schema.required ?? []
    return Object.entries(schema.properties ?? {}).map(([name, property]) =>
      field(name, property, required.includes(name)),
    )
  }

  if (entry.kind === 'prompt') {
    return entry.args.map((argument) =>
      field(
        argument.name,
        { type: 'string', description: argument.description },
        argument.required,
      ),
    )
  }

  if (entry.kind === 'template') {
    return [...entry.uriTemplate.matchAll(/{(\w+)}/g)].map(([, name]) =>
      field(name, { type: 'string' }, true),
    )
  }

  return []
}

function field(name, property, required) {
  const label = document.createElement('label')
  const caption = document.createElement('span')
  caption.className = 'name'
  caption.textContent = required ? name : `${name} (optional)`
  label.append(caption)

  const hint = [
    property.description,
    property.default !== undefined && `default: ${JSON.stringify(property.default)}`,
  ]
    .filter(Boolean)
    .join(' · ')

  if (hint) {
    label.append(
      Object.assign(document.createElement('span'), { className: 'hint', textContent: hint }),
    )
  }

  const input = control(property)
  label.append(input)

  if (property.type === 'boolean') {
    label.classList.add('inline')
    label.prepend(input)
  }

  return { name, node: label, input, property, required }
}

function control(property) {
  if (property.enum) {
    const select = document.createElement('select')
    select.append(...property.enum.map((value) => new Option(value, value)))
    if (property.default !== undefined) select.value = property.default
    return select
  }

  if (property.type === 'boolean') {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = property.default === true
    return input
  }

  if (property.type === 'number' || property.type === 'integer') {
    const input = document.createElement('input')
    input.type = 'number'
    if (property.type === 'number') input.step = 'any'
    if (property.default !== undefined) input.value = property.default
    return input
  }

  // Objects and arrays have no sensible widget, so take raw JSON instead.
  if (property.type === 'object' || property.type === 'array') {
    const textarea = document.createElement('textarea')
    textarea.placeholder = property.type === 'array' ? '[]' : '{}'
    return textarea
  }

  const input = document.createElement('input')
  input.type = 'text'
  if (property.default !== undefined) input.value = property.default
  return input
}

/** Empty optional fields are dropped so the server applies its own defaults. */
function collect(fields) {
  const values = {}

  for (const { name, input, property, required } of fields) {
    if (property.type === 'boolean') {
      values[name] = input.checked
      continue
    }

    const raw = input.value.trim()
    if (raw === '' && !required) continue

    if (property.type === 'number' || property.type === 'integer') {
      values[name] = Number(raw)
    } else if (property.type === 'object' || property.type === 'array') {
      values[name] = JSON.parse(raw || (property.type === 'array' ? '[]' : '{}'))
    } else {
      values[name] = raw
    }
  }

  return values
}

function invoke(entry, fields) {
  const values = collect(fields)

  if (entry.kind === 'tool') {
    return rpc('tools/call', { name: entry.name, arguments: values })
  }

  if (entry.kind === 'prompt') {
    // Prompt arguments travel as strings over the protocol.
    const args = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, String(value)]),
    )
    return rpc('prompts/get', { name: entry.name, arguments: args })
  }

  const uri =
    entry.uri ??
    entry.uriTemplate.replace(/{(\w+)}/g, (_, name) => encodeURIComponent(values[name] ?? ''))

  return rpc('resources/read', { uri })
}

/* Output */

function present(result) {
  const nodes = []

  if (result.isError) {
    nodes.push(
      Object.assign(document.createElement('span'), { className: 'badge', textContent: 'isError' }),
    )
  }

  for (const block of result.content ?? []) {
    nodes.push(...contentBlock(block))
  }

  for (const entry of result.contents ?? []) {
    nodes.push(label(entry.uri), text(entry.text ?? `[${entry.blob?.length ?? 0} base64 chars]`))
  }

  for (const message of result.messages ?? []) {
    nodes.push(label(message.role), text(message.content.text ?? JSON.stringify(message.content)))
  }

  if (result.structuredContent) {
    nodes.push(label('structuredContent'), text(JSON.stringify(result.structuredContent, null, 2)))
  }

  if (nodes.length === 0) {
    nodes.push(text('(no content)'))
  }

  return nodes
}

function contentBlock(block) {
  if (block.type === 'text') {
    return [text(block.text)]
  }

  if (block.type === 'image') {
    const image = document.createElement('img')
    image.src = `data:${block.mimeType};base64,${block.data}`
    image.alt = 'image content block'
    return [label(`image · ${block.mimeType}`), image]
  }

  return [label(block.type), text(JSON.stringify(block, null, 2))]
}

const label = (value) => Object.assign(document.createElement('h3'), { textContent: value })
const text = (value) => Object.assign(document.createElement('pre'), { textContent: value })

function failure(error) {
  const node = text(
    error.data ? `${error.message}\n\n${JSON.stringify(error.data, null, 2)}` : error.message,
  )
  node.className = 'failed'
  return node
}

/** Seeing the raw envelope is half the point of a toolkit playground. */
function wirePanel() {
  const details = document.createElement('details')
  details.append(Object.assign(document.createElement('summary'), { textContent: 'Wire' }))

  const wire = document.createElement('div')
  wire.className = 'wire'
  wire.append(
    label('request'),
    text(JSON.stringify(state.wire?.request, null, 2)),
    label('response'),
    text(JSON.stringify(state.wire?.response, null, 2)),
  )

  details.append(wire)
  return details
}

/* Boot */

for (const era of Object.keys(PROTOCOL)) {
  const button = document.createElement('button')
  button.textContent = era
  button.title = PROTOCOL[era]
  button.ariaPressed = String(era === state.era)
  button.onclick = () => {
    state.era = era
    for (const sibling of el.eras.children) {
      sibling.ariaPressed = String(sibling.textContent === era)
    }
    load()
  }
  el.eras.append(button)
}

await load()
