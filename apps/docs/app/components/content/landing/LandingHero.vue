<script setup lang="ts">
import { Motion } from 'motion-v'

// @ts-expect-error yaml is not typed
import hero from './hero.yml'

const copied = ref(false)

async function copyCommand() {
  await navigator.clipboard.writeText('npx skills add nuxt-modules/mcp-toolkit')
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>

<template>
  <UPageHero
    v-if="hero"
    orientation="horizontal"
    :description="hero.description"
    :links="hero.links"
    :ui="{
      root: 'relative overflow-hidden',
      container: 'py-18 sm:py-24 lg:py-32',
      wrapper: 'lg:w-[600px]',
      title: 'text-left max-w-xl text-pretty leading-normal py-2 font-normal text-3xl sm:text-4xl lg:text-5xl pb-2',
      description: 'text-left mt-2 text-md max-w-xl text-pretty sm:text-md text-muted',
      links: 'mt-4 justify-start gap-2',
    }"
  >
    <template #title>
      <Motion
        :initial="{ opacity: 0, filter: 'blur(4px)' }"
        :animate="{ opacity: 1, filter: 'blur(0px)' }"
        :transition="{ duration: 0.6, delay: 0.5 }"
      >
        <button
          class="group mb-2 flex items-center gap-2 font-mono text-sm transition-colors cursor-copy"
          :class="copied ? 'text-emerald-500' : 'text-muted hover:text-highlighted'"
          @click="copyCommand"
        >
          <span v-if="copied">Copied!</span>
          <span v-else>$ npx skills add nuxt-modules/mcp-toolkit</span>
        </button>
      </Motion>

      <ChromaText>{{ hero.title }}</ChromaText>
    </template>

    <template #links>
      <template
        v-for="(link, index) in hero.links"
        :key="index"
      >
        <UInputCopy
          v-if="link.value"
          :value="link.value"
        />
        <UButton
          v-else
          v-bind="link"
        />
      </template>
    </template>

    <HeroShader class="hidden md:block absolute inset-0 translate-x-1/4 pointer-events-none" />
  </UPageHero>
</template>
