<template>
  <div :class="['mb-4', isUser ? 'flex justify-end' : 'flex justify-start']">
    <div 
      :class="[
        'p-3 rounded-lg max-w-full',
        isUser ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200'
      ]"
    >
      <MarkdownRenderer :source="content" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { MarkdownRenderer } from './MarkdownRenderer'

const props = defineProps<{
  isUser: boolean
  content: string
}>()
</script>
