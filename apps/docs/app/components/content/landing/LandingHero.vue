<script setup lang="ts">
// @ts-expect-error yaml is not typed
import hero from './hero.yml'
</script>

<template>
  <UPageHero
    v-if="hero"
    orientation="horizontal"
    :ui="{
      container: 'py-18 sm:py-24 lg:py-32',
      wrapper: 'lg:w-[600px]',
      title: 'text-left max-w-xl text-pretty leading-normal py-2',
      description: 'text-left mt-2 text-md max-w-xl text-pretty sm:text-md text-muted',
      links: 'mt-4 justify-start',
    }"
  >
    <template #title>
      <h1 class="font-normal main-gradient text-3xl sm:text-4xl lg:text-5xl pb-2">
        {{ hero.title }}
      </h1>
    </template>

    <template #description>
      {{ hero.description }}
    </template>

    <template #links>
      <div
        v-if="hero.links"
        class="flex items-center gap-2"
      >
        <UButton
          v-for="(link, index) in hero.links"
          :key="index"
          v-bind="link"
        />
      </div>
    </template>

    <ClientOnly>
      <HeroShader />
    </ClientOnly>
  </UPageHero>
</template>
