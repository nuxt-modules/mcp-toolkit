export interface McpNitro {
  options: {
    rootDir: string
    buildDir: string
    dev: boolean
    virtual: Record<string, string | (() => string | Promise<string>)>
    handlers: {
      route?: string
      handler: string
      lazy?: boolean
      middleware?: boolean
    }[]
    typescript: { generatedTypesDir?: string; tsconfigPath?: string }
  }
  logger: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
  }
  hooks: {
    hook: (
      name: 'close' | 'compiled' | 'types:extend',
      callback: () => void | Promise<void>,
    ) => void
    callHook: (name: 'rollup:reload') => void | Promise<unknown>
  }
}
