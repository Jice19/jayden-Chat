<template>
  <div class="flex h-screen w-full bg-[var(--color-background)] overflow-hidden">

    <!-- 侧边栏 -->
    <div class="w-56 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col flex-shrink-0 p-3 gap-2">
      <NuxtLink
        to="/"
        class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] transition-colors"
      >
        ← 返回聊天
      </NuxtLink>
      <div class="flex justify-center pt-1">
        <ThemeToggle />
      </div>
      <div class="mt-2 px-2 text-xs text-[var(--color-text-disabled)] font-medium">功能说明</div>
      <div class="px-3 py-2 rounded-lg bg-[var(--color-hover)] text-xs text-[var(--color-text-secondary)] leading-relaxed space-y-1">
        <p>🤖 一个输入框，自动判断：</p>
        <p>· 文字问题 → AI 文字回答</p>
        <p>· "画/生成图片" → 生成图片</p>
        <p>· 两个都要 → 文字 + 图片同时返回</p>
      </div>
    </div>

    <!-- 主区域 -->
    <div class="flex-1 flex flex-col h-full min-w-0">

      <!-- 消息列表 -->
      <div ref="chatContainerRef" class="flex-1 overflow-y-auto px-4 py-6 space-y-4">

        <!-- 空状态提示 -->
        <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full gap-3 text-[var(--color-text-disabled)]">
          <div class="text-5xl">✨</div>
          <p class="text-base font-medium">统一智能助手</p>
          <p class="text-sm text-center max-w-xs">
            试着说：<br>
            "帮我画一只可爱的蓝色猫咪"<br>
            "解释一下量子纠缠"<br>
            "画一朵玫瑰，并解释它的花语"
          </p>
        </div>

        <!-- 消息气泡 -->
        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="flex gap-3"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <!-- AI 头像 -->
          <div v-if="msg.role !== 'user'" class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm flex-shrink-0 mt-1">
            AI
          </div>

          <!-- 消息内容 -->
          <div
            class="max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed"
            :class="msg.role === 'user'
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-tl-sm border border-[var(--color-border)]'"
          >
            <!-- 用户消息 -->
            <template v-if="msg.role === 'user'">{{ msg.content }}</template>

            <!-- AI 消息 -->
            <template v-else>
              <!-- 加载中动画 -->
              <div v-if="msg.loading" class="flex items-center gap-2 text-[var(--color-text-secondary)]">
                <div class="flex gap-1">
                  <span class="w-2 h-2 rounded-full bg-current animate-bounce" style="animation-delay:0ms"></span>
                  <span class="w-2 h-2 rounded-full bg-current animate-bounce" style="animation-delay:150ms"></span>
                  <span class="w-2 h-2 rounded-full bg-current animate-bounce" style="animation-delay:300ms"></span>
                </div>
                <span class="text-xs">思考中...</span>
              </div>

              <!-- 意图标签 -->
              <div v-if="!msg.loading && msg.intent" class="mb-2">
                <span
                  class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                  :class="{
                    'bg-blue-100 text-blue-700': msg.intent === 'text',
                    'bg-purple-100 text-purple-700': msg.intent === 'image',
                    'bg-green-100 text-green-700': msg.intent === 'both',
                  }"
                >
                  {{ intentLabel[msg.intent] }}
                </span>
              </div>

              <!-- 错误提示 -->
              <div v-if="msg.error" class="text-red-500 text-xs">{{ msg.error }}</div>

              <!-- 文字回复 -->
              <p v-if="msg.textReply" class="whitespace-pre-wrap">{{ msg.textReply }}</p>

              <!-- 图片回复 -->
              <div v-if="msg.imageUrl" :class="msg.textReply ? 'mt-3' : ''">
                <img
                  :src="msg.imageUrl"
                  class="rounded-xl max-w-sm w-full object-cover shadow"
                  alt="生成的图片"
                />
                <a
                  :href="msg.imageUrl"
                  target="_blank"
                  class="mt-1 inline-block text-xs text-blue-500 hover:underline"
                >
                  下载图片
                </a>
              </div>
            </template>
          </div>

          <!-- 用户头像 -->
          <div v-if="msg.role === 'user'" class="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-sm flex-shrink-0 mt-1 overflow-hidden">
            <img v-if="userAvatar" :src="userAvatar" class="w-full h-full object-cover" />
            <span v-else>我</span>
          </div>
        </div>

      </div>

      <!-- 输入区 -->
      <div class="bg-[var(--color-surface)] border-t border-[var(--color-border)] p-4">
        <div class="max-w-3xl mx-auto relative">
          <textarea
            v-model="inputText"
            class="w-full bg-[var(--color-background)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-xl p-3 pr-24 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none shadow-sm text-sm"
            placeholder="输入文字问题或图片需求，AI 自动判断…（Enter 发送，Shift+Enter 换行）"
            rows="3"
            :disabled="isSending"
            @keydown.enter.exact.prevent="onSend"
          ></textarea>
          <div class="absolute bottom-3 right-3">
            <button
              @click="onSend"
              :disabled="isSending || !inputText.trim()"
              class="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {{ isSending ? '处理中...' : '发送' }}
            </button>
          </div>
        </div>
        <p class="text-center text-xs text-[var(--color-text-disabled)] mt-2">
          由 LangGraph 驱动 · qwen-plus + qwen-image-2.0
        </p>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useAvatar } from '~/composables/useAvatar'
import { useApi } from '~/composables/useApi'

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string          // 用户消息内容
  loading?: boolean        // AI 消息是否正在加载
  intent?: 'text' | 'image' | 'both'
  textReply?: string
  imageUrl?: string
  error?: string
}

// ─── 状态 ─────────────────────────────────────────────────────────────────────

const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const isSending = ref(false)
const chatContainerRef = ref<HTMLElement | null>(null)

const { userAvatar } = useAvatar()
const axios = useApi()

const intentLabel: Record<string, string> = {
  text: '💬 文字回答',
  image: '🎨 图片生成',
  both: '✨ 文字 + 图片'
}

// ─── 核心：发送消息 ──────────────────────────────────────────────────────────

async function onSend() {
  const text = inputText.value.trim()
  if (!text || isSending.value) return

  // 1. 添加用户消息到列表
  messages.value.push({ role: 'user', content: text })
  inputText.value = ''
  isSending.value = true

  // 2. 添加 AI 占位消息（加载动画）
  const aiMsgIndex = messages.value.length
  messages.value.push({ role: 'assistant', content: '', loading: true })

  // 3. 滚动到底部
  await nextTick()
  scrollToBottom()

  try {
    // 4. 调用统一 API（拦截器已返回 response.data，无需再取 .data）
    const result = await axios.post('/chat/unified', { message: text }) as unknown as {
      intent: 'text' | 'image' | 'both'
      textReply: string
      imageUrl: string
      error: string
    }
    const { intent, textReply, imageUrl, error } = result

    // 5. 更新 AI 消息
    messages.value[aiMsgIndex] = {
      role: 'assistant',
      content: textReply || '',
      loading: false,
      intent,
      textReply,
      imageUrl,
      error
    }
  } catch (err: unknown) {
    messages.value[aiMsgIndex] = {
      role: 'assistant',
      content: '',
      loading: false,
      error: `请求失败：${(err as Error).message}`
    }
  } finally {
    isSending.value = false
    await nextTick()
    scrollToBottom()
  }
}

function scrollToBottom() {
  if (chatContainerRef.value) {
    chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight
  }
}
</script>
