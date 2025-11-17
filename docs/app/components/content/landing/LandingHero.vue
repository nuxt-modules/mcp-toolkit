<script setup lang="ts">
import {
  Shader,
  DotGrid,
  Glow,
  GridDistortion,
  ImageTexture,
} from 'shaders/vue'

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
      description: 'text-left mt-2 text-md max-w-2xl text-pretty sm:text-md text-muted',
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

    <Shader class="h-[300px] sm:h-[400px]">
      <ImageTexture
        id="idmi372riw2o0ok3vcx"
        url="https://rgqpsgmnzmniyzelfbfx.supabase.co/storage/v1/object/public/user-uploaded-images/user_34L5xrap4IrtzxuLli0GTOeUth8/RlvZEumAIgm6.png"
        :visible="false"
        mask-type="alpha"
        object-fit="contain"
        :transform="{ edges: 'transparent', scale: 1, anchorX: 0.5, anchorY: 0.5, offsetX: 0, offsetY: 0, rotation: 0 }"
      />
      <DotGrid
        color="#ffffff"
        :density="80"
        :dot-size="0.3"
        :twinkle="1"
        mask-type="alpha"
        :transform="{ edges: 'transparent', scale: 1, anchorX: 0.5, anchorY: 0.5, offsetX: 0, offsetY: 0, rotation: 0 }"
        mask-source="idmi372riw2o0ok3vcx"
      />
      <Glow
        :size="7.55"
        mask-type="alpha"
        :intensity="0.23"
        :threshold="0.13"
        :transform="{ edges: 'transparent', scale: 1, anchorX: 0.5, anchorY: 0.5, offsetX: 0, offsetY: 0, rotation: 0 }"
      />
      <GridDistortion
        :decay="3"
        edges="stretch"
        :swirl="0"
        :radius="1"
        :grid-size="20"
        :intensity="1"
      />
    </Shader>
  </UPageHero>
</template>
