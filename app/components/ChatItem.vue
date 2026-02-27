<template>
  <div :class="['mb-4', isUser ? 'flex justify-end' : 'flex justify-start']">
    <div 
      :class="[
        'p-3 rounded-lg max-w-[70%]',
        isUser ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200'
      ]"
    >
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isUser: boolean
}>()
</script>
