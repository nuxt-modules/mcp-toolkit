import MyModule from '../../../src/module'

export default defineNuxtConfig({
  extends: ['./layers/override-layer'],
  modules: [
    MyModule,
  ],
})
