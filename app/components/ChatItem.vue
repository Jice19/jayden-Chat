<template>
  <div :class="['mb-4 flex items-end gap-2', isUser ? 'flex-row-reverse' : 'flex-row']">
    <!-- 头像 -->
    <div class="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden self-end">
      <!-- 用户：已上传头像 -->
      <img
        v-if="isUser && userAvatar"
        :src="userAvatar"
        alt="用户头像"
        class="w-full h-full object-cover"
      />
      <!-- 用户：默认占位头像 -->
      <div
        v-else-if="isUser"
        class="w-full h-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold select-none"
      >
        U
      </div>
      <!-- AI：固定渐变头像 -->
      <div
        v-else
        class="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center"
      >
        <svg viewBox="0 0 24 24" class="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 10.975V8a2 2 0 0 0-2-2h-6V4.688c.305-.274.5-.668.5-1.11a1.5 1.5 0 0 0-3 0c0 .442.195.836.5 1.11V6H5a2 2 0 0 0-2 2v2.975A2 2 0 0 0 2 13v2a2 2 0 0 0 1 1.723V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2.277A2 2 0 0 0 22 15v-2a2 2 0 0 0-1-1.025zM9 9.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-3 7.5c-1.813 0-3.35-.994-3.822-2.35a.5.5 0 0 1 .95-.3C9.516 15.344 10.653 16 12 16s2.484-.656 2.872-1.65a.5.5 0 1 1 .95.3C15.35 16.006 13.813 17 12 17z"/>
        </svg>
      </div>
    </div>

    <!-- 消息气泡 -->
    <div
      :class="[
        'p-3 rounded-2xl max-w-[75%] relative group',
        isUser
          ? 'bg-blue-500 text-white rounded-br-sm'
          : 'bg-white border border-gray-200 text-gray-700 rounded-bl-sm'
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
  userAvatar?: string
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
