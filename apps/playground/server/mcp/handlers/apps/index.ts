// Folder handler at `/mcp/apps`. The Apps bundler tags every generated tool /
// resource with `handler: 'apps'`, so this handler auto-attributes them via
// folder convention. With `defaultHandlerStrategy: 'orphans'` (default) the
// `/mcp` route also excludes them — no manual filtering required.
export default defineMcpHandler({
  description:
    'Interactive MCP Apps demo — Vue-authored widgets (stay-finder carousel + stay-checkout flow) '
    + 'bundled into self-contained HTML and rendered by the host inside an iframe.',
  instructions:
    'Use `stay-finder` to surface a carousel of available stays for a destination. '
    + 'When the user picks one to reserve, route to `stay-checkout` with the stay name, '
    + 'destination, dates, traveler count and price per night.',
})
