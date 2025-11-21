import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: {
    stylistic: true,
  },
}).overrideRules({
  'vue/multi-word-component-names': 'off',
})
