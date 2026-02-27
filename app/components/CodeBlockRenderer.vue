<template>
  <div class="rounded-lg overflow-hidden">
    <component :is="highlightVnode" />
  </div>
</template>

<script setup lang="ts">
import type { VNode } from 'vue'

defineProps<{
  highlightVnode: VNode
  language: string
}>()
</script>
