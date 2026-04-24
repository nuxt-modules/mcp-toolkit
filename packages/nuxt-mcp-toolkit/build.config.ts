import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  // Inline the module entry into a single dist/module.mjs (no `dist/shared/<chunk>.mjs`)
  // so that `createResolver(import.meta.url)` inside `setup()` resolves
  // `runtime/components/InstallButton.vue` to `dist/runtime/...` instead of
  // `dist/shared/runtime/...` (which `nuxt-component-meta` reads strictly via mlly).
  rollup: {
    output: {
      inlineDynamicImports: true,
    },
  },
})
