<template>
  <div :class="['mb-4', isUser ? 'flex justify-end' : 'flex justify-start']">
    <div 
      :class="[
        'p-3 rounded-lg max-w-full relative group',
        isUser ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200'
      ]"
    >
      <button
        class="absolute top-1 right-1 text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white/90 text-gray-700 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:shadow hover:bg-white active:scale-95 z-10"
        @click="onCopy"
        type="button"
      >
        {{ copyLabel }}
      </button>
      <div v-if="!content && !isUser" class="flex items-center gap-1 text-gray-400">
        <span class="animate-bounce">●</span>
        <span class="animate-bounce delay-100">●</span>
        <span class="animate-bounce delay-200">●</span>
      </div>
      <MarkdownRenderer :source="content" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { MarkdownRenderer } from './MarkdownRenderer'

const props = defineProps<{
  isUser: boolean
  content: string
}>()

const copyLabel = ref('复制')
let copyTimer: number | null = null

const setCopyLabel = (label: string) => {
  copyLabel.value = label
  if (copyTimer !== null) {
    window.clearTimeout(copyTimer)
  }
  copyTimer = window.setTimeout(() => {
    copyLabel.value = '复制'
    copyTimer = null
  }, 1200)
}

const fallbackCopy = (text: string) => {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(textarea)
  return ok
}

const onCopy = async () => {
  const text = props.content ?? ''
  if (!text) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      setCopyLabel('已复制')
      return
    }
  } catch {}
  const ok = fallbackCopy(text)
  setCopyLabel(ok ? '已复制' : '复制失败')
}
</script>
