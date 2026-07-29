// Ambient on purpose: this declares the modules `mcp()` generates, so a route
// can `import mcp from '#mcp/mcp/handler'` with nothing to configure. A
// top-level import or export would make this a module, and the declaration
// below an augmentation of a module that does not exist yet — hence the inline
// import. The build rewrites that specifier for the copy it ships beside the
// built types.
declare module '#mcp/*/handler' {
  const handler: import('./index.ts').McpHandler
  export default handler
}
