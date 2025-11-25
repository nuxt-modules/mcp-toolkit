<script setup lang="ts">
import {
  Shader,
  DotGrid,
  Glow,
  GridDistortion,
  ImageTexture,
} from 'shaders/vue'
</script>

<template>
  <Motion
    :initial="{ opacity: 0 }"
    :animate="{ opacity: 1 }"
    :transition="{ duration: 2, ease: 'easeOut' }"
  >
    <Shader class="size-full invert dark:invert-0">
      <ImageTexture
        id="idmi372riw2o0ok3vcx"
        url="/mcp.png"
        :visible="false"
        mask-type="alpha"
        object-fit="contain"
        :transform="{ edges: 'transparent', scale: 1.2, anchorX: 0.5, anchorY: 0.5, offsetX: 0, offsetY: 0, rotation: 0 }"
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
  </Motion>
</template>
