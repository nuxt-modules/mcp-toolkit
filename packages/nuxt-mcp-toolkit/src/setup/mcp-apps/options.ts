import type { PluginOption } from 'vite'

export interface McpAppsOptions {
  /**
   * Additional plugins for the isolated Vite build used for MCP Apps.
   * The toolkit's Vue and single-file plugins are always retained.
   */
  vitePlugins?: PluginOption[]
  /**
   * Default-exported Vue plugins to install before the MCP App mounts.
   * Use package specifiers such as `@nuxt/ui/vue-plugin`.
   */
  vuePlugins?: string[]
  /**
   * Stylesheets to import into every app bundle.
   * `~` and `@` resolve from the Nuxt source directory.
   */
  css?: string[]
  /**
   * Replace the generated Vue mount entry. Cannot be combined with `vuePlugins`.
   * Stylesheets are still imported first.
   */
  entry?: string
}
