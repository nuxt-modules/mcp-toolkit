<script setup lang="ts">
// @ts-expect-error yaml is not typed
import hero from './hero.yml'
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
