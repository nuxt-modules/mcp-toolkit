<script setup lang="ts">
const title = 'Nuxt MCP Module'
const description = 'Create MCP servers directly in your Nuxt application. Define tools, resources, and prompts with a simple and intuitive API.'
const links = [
  {
    label: 'Get Started',
    to: '/getting-started/installation',
  },
  {
    label: 'Documentation',
    to: '/getting-started/introduction',
  },
]
</script>

<template>
  <UPageHero
    orientation="horizontal"
    :ui="{
      container: 'py-18 sm:py-24 lg:py-32',
      wrapper: 'lg:w-[600px]',
      title: 'text-left max-w-xl text-pretty',
      description: 'text-left mt-2 text-md max-w-xl text-pretty sm:text-md text-muted',
      links: 'mt-4 justify-start',
    }"
  >
    <template #title>
      <Motion
        :initial="{
          scale: 1.1,
          opacity: 0,
          filter: 'blur(20px)',
        }"
        :animate="{
          scale: 1,
          opacity: 1,
          filter: 'blur(0px)',
        }"
        :transition="{
          duration: 0.6,
          delay: 0.1,
        }"
      >
        <h1 class="font-normal main-gradient text-3xl sm:text-4xl lg:text-5xl">
          {{ title }}
        </h1>
      </Motion>
    </template>

    <template #description>
      <Motion
        :initial="{
          scale: 1.1,
          opacity: 0,
          filter: 'blur(20px)',
        }"
        :animate="{
          scale: 1,
          opacity: 1,
          filter: 'blur(0px)',
        }"
        :transition="{
          duration: 0.6,
          delay: 0.3,
        }"
      >
        {{ description }}
      </Motion>
    </template>

    <template #links>
      <Motion
        :initial="{
          scale: 1.1,
          opacity: 0,
          filter: 'blur(20px)',
        }"
        :animate="{
          scale: 1,
          opacity: 1,
          filter: 'blur(0px)',
        }"
        :transition="{
          duration: 0.6,
          delay: 0.5,
        }"
      >
        <div
          v-if="links"
          class="flex items-center gap-2"
        >
          <UButton
            :label="links[0]?.label"
            :to="links[0]?.to"
          />
          <UButton
            :ui="{ label: 'main-gradient' }"
            variant="ghost"
            v-bind="links[1]"
          />
        </div>
      </Motion>
    </template>

    <HeroShader />
  </UPageHero>
</template>
