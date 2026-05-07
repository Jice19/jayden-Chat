<template>
  <div class="flex h-screen w-full bg-[var(--color-background)] overflow-hidden">

    <!-- 侧边栏 -->
    <div class="w-64 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col flex-shrink-0">
      <div class="p-4 border-b border-[var(--color-border)] space-y-3">
        <NuxtLink
          to="/chat"
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>💬</span> AI 聊天
        </NuxtLink>
        <NuxtLink
          to="/rag"
          class="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>📚</span> RAG 知识库
        </NuxtLink>
        <NuxtLink
          to="/image"
          class="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>🎨</span> AI 图片生成
        </NuxtLink>
        <NuxtLink
          to="/virtual-list-demo"
          class="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>🚀</span> 虚拟列表演示
        </NuxtLink>
        <!-- 主题切换按钮 -->
        <div class="flex justify-center pt-2">
          <ThemeToggle />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-3 space-y-4">
        <div>
          <div class="px-2 text-xs text-[var(--color-text-disabled)] font-medium mb-2">功能说明</div>
          <div class="px-3 py-2 rounded-lg bg-[var(--color-hover)] text-xs text-[var(--color-text-secondary)] leading-relaxed space-y-1">
            <p>🤖 一个输入框，自动判断：</p>
            <p>· 文字问题 → AI 文字回答</p>
            <p>· "画/生成图片" → 生成图片</p>
            <p>· 两个都要 → 文字 + 图片同时返回</p>
          </div>
        </div>

        <div>
          <div class="px-2 text-xs text-[var(--color-text-disabled)] font-medium mb-2">性能设置</div>
          <div class="px-3 py-3 rounded-lg bg-[var(--color-hover)] text-xs text-[var(--color-text-secondary)] space-y-3">
            <div class="space-y-1">
              <label class="block text-[var(--color-text-secondary)]">压测模式</label>
              <select
                :value="benchmarkMode"
                class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
                @change="onBenchmarkModeChange"
              >
                <option value="optimized">optimized（复用单例）</option>
                <option value="baseline">baseline（每次重建）</option>
              </select>
            </div>

            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="resetSingletons"
                type="checkbox"
                class="h-3.5 w-3.5 rounded border-[var(--color-border)]"
              >
              <span>重置时清空单例</span>
            </label>

            <div class="flex gap-2">
              <button
                class="flex-1 rounded-md border border-[var(--color-border)] px-2 py-1 hover:bg-[var(--color-surface)] disabled:opacity-60"
                :disabled="isMetricsLoading"
                @click="fetchMetrics"
              >
                {{ isMetricsLoading ? '刷新中...' : '刷新统计' }}
              </button>
              <button
                class="flex-1 rounded-md bg-blue-600 px-2 py-1 text-white hover:bg-blue-700 disabled:opacity-60"
                :disabled="isMetricsResetting"
                @click="resetMetrics"
              >
                {{ isMetricsResetting ? '重置中...' : '重置统计' }}
              </button>
            </div>

            <div v-if="metricsError" class="text-[11px] text-red-500">{{ metricsError }}</div>

            <div v-if="metrics" class="space-y-1 text-[11px]">
              <p>窗口开始：{{ formatTime(metrics.performance.windowStartedAt) }}</p>
              <p>总请求：{{ metrics.performance.totalRequests }}（成功 {{ metrics.performance.successRequests }} / 失败 {{ metrics.performance.failedRequests }}）</p>
              <p>整体均值：{{ formatMs(metrics.performance.averageDurationMs) }} / P95：{{ formatMs(metrics.performance.p95DurationMs) }}</p>
              <p>baseline：{{ metrics.performance.modeSummary.baseline.requestCount }} 次，均值 {{ formatMs(metrics.performance.modeSummary.baseline.averageDurationMs) }}</p>
              <p>optimized：{{ metrics.performance.modeSummary.optimized.requestCount }} 次，均值 {{ formatMs(metrics.performance.modeSummary.optimized.averageDurationMs) }}</p>
              <p v-if="performanceReduction !== null">优化降幅：{{ performanceReduction }}%</p>
              <p>图编译次数：{{ metrics.runtime.graphCompileCount }} · LLM 创建次数：{{ metrics.runtime.llmCreateCount }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 用户信息区 -->
      <div class="p-4 border-t border-[var(--color-border)] flex-shrink-0">
        <div class="flex items-center gap-3">
          <label class="relative cursor-pointer group flex-shrink-0" title="点击更换头像">
            <div class="w-10 h-10 rounded-full overflow-hidden ring-2 ring-offset-1 ring-blue-200 group-hover:ring-blue-500 transition-all">
              <img v-if="userAvatar" :src="userAvatar" alt="头像" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold select-none">
                {{ authUser?.username?.[0]?.toUpperCase() || 'U' }}
              </div>
            </div>
            <div class="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" @change="onAvatarChange" />
          </label>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-[var(--color-text-primary)] truncate">{{ authUser?.username || '未登录' }}</p>
            <p v-if="uploadError" class="text-xs text-red-500 truncate">{{ uploadError }}</p>
            <p v-else-if="isUploading" class="text-xs text-blue-500">上传中...</p>
            <p v-else class="text-xs text-[var(--color-text-disabled)]">{{ userAvatar ? '点击头像更换' : '点击头像上传' }}</p>
          </div>
          <button
            @click="logout"
            title="退出登录"
            class="flex-shrink-0 p-1.5 rounded-lg text-[var(--color-text-disabled)] hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 主区域 -->
    <div class="flex-1 flex flex-col h-full min-w-0">

      <!-- 消息列表 -->
      <div ref="chatContainerRef" class="flex-1 overflow-y-auto px-4 py-6">
        <div class="responsive-input-container mx-auto space-y-4">

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
              <p v-if="msg.streaming" class="text-xs text-[var(--color-text-disabled)] mt-1">输出中...</p>

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

              <!-- 图片占位符 -->
              <div v-else-if="msg.imageLoading" :class="msg.textReply ? 'mt-3' : ''" class="w-full max-w-sm">
                <div class="h-52 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-hover)] animate-pulse flex items-center justify-center text-xs text-[var(--color-text-disabled)]">
                  图片生成中...
                </div>
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

    </div>

      <!-- 输入区 -->
      <div class="bg-[var(--color-surface)] border-t border-[var(--color-border)] p-4">
        <div class="responsive-input-container mx-auto relative">
          <textarea
            v-model="inputText"
            class="responsive-textarea w-full bg-[var(--color-background)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-xl p-3 pr-24 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none shadow-sm text-sm"
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
          由 LangGraph 驱动 · qwen3.6-plus + qwen-image-2.0
        </p>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import type { Event } from 'vue'
import { useAvatar } from '~/composables/useAvatar'
import { useApi } from '~/composables/useApi'
import { useAuth } from '~/composables/useAuth'
import { useUnifiedPerformance } from '~/composables/useUnifiedPerformance'
import type { UnifiedBenchmarkMode, UnifiedResponse } from '~/../../types/unified'

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string          // 用户消息内容
  loading?: boolean        // AI 消息是否正在加载
  streaming?: boolean      // 文字是否正在“流式”展示
  intent?: 'text' | 'image' | 'both'
  textReply?: string
  imageUrl?: string
  imageLoading?: boolean   // 图片是否正在等待展示
  error?: string
}

// ─── 状态 ─────────────────────────────────────────────────────────────────────

const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const isSending = ref(false)
const chatContainerRef = ref<HTMLElement | null>(null)

const { userAvatar, isUploading, uploadError, uploadAvatar } = useAvatar()
const { user: authUser, logout } = useAuth()
const axios = useApi()
const {
  benchmarkMode,
  metrics,
  isMetricsLoading,
  isMetricsResetting,
  metricsError,
  resetSingletons,
  performanceReduction,
  setBenchmarkMode,
  fetchMetrics,
  resetMetrics
} = useUnifiedPerformance()

const onAvatarChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  await uploadAvatar(file)
  // 清空 input，允许重复选同一文件
  ;(e.target as HTMLInputElement).value = ''
}

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
  messages.value.push({
    role: 'assistant',
    content: '',
    loading: true,
    streaming: false,
    imageLoading: false
  })

  // 3. 滚动到底部
  await nextTick()
  scrollToBottom()

  try {
    // 4. 调用统一 API（拦截器已返回 response.data，无需再取 .data）
    const { intent, textReply, imageUrl, error } = await axios.post<UnifiedResponse>(
      '/chat/unified',
      { message: text },
      {
        headers: {
          'x-unified-benchmark-mode': benchmarkMode.value
        }
      }
    ) as unknown as UnifiedResponse

    const shouldShowImagePlaceholder = intent === 'image' || intent === 'both'
    messages.value[aiMsgIndex] = {
      role: 'assistant',
      content: '',
      loading: false,
      streaming: Boolean(textReply),
      intent,
      textReply: '',
      imageUrl: '',
      imageLoading: shouldShowImagePlaceholder,
      error
    }

    if (textReply) {
      await streamTextReply(aiMsgIndex, textReply)
    }

    if (imageUrl) {
      const targetMsg = messages.value[aiMsgIndex]
      if (targetMsg) {
        targetMsg.imageUrl = imageUrl
        targetMsg.imageLoading = false
      }
    } else if (shouldShowImagePlaceholder) {
      const targetMsg = messages.value[aiMsgIndex]
      if (targetMsg) {
        targetMsg.imageLoading = false
      }
    }
  } catch (err: unknown) {
    messages.value[aiMsgIndex] = {
      role: 'assistant',
      content: '',
      loading: false,
      streaming: false,
      imageLoading: false,
      error: `请求失败：${(err as Error).message}`
    }
  } finally {
    isSending.value = false
    await fetchMetrics()
    await nextTick()
    scrollToBottom()
  }
}

async function streamTextReply(messageIndex: number, fullText: string): Promise<void> {
  const chunkSize = 3
  const intervalMs = 20
  let cursor = 0

  while (cursor < fullText.length) {
    const targetMsg = messages.value[messageIndex]
    if (!targetMsg) return

    cursor = Math.min(cursor + chunkSize, fullText.length)
    targetMsg.textReply = fullText.slice(0, cursor)
    targetMsg.content = targetMsg.textReply
    await wait(intervalMs)
  }

  const targetMsg = messages.value[messageIndex]
  if (targetMsg) {
    targetMsg.streaming = false
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function onBenchmarkModeChange(event: Event) {
  const target = event.target as HTMLSelectElement | null
  if (!target) return
  if (target.value === 'baseline' || target.value === 'optimized') {
    setBenchmarkMode(target.value as UnifiedBenchmarkMode)
  }
}

function formatMs(value: number): string {
  return `${value.toFixed(2)}ms`
}

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString()
}

function scrollToBottom() {
  if (chatContainerRef.value) {
    chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight
  }
}

onMounted(() => {
  fetchMetrics()
})
</script>

<style scoped>
/* 响应式布局：基于 vh/vw 实现等比例缩放，同时保持间距固定 */
.responsive-input-container {
  /* 宽度随窗口变化，使用 vw。clamp 确保在极小/极大屏幕下依然可用 */
  width: clamp(320px, 80vw, 1200px);
  /* 这里的等比例感可以通过容器宽度来驱动 */
}

.responsive-textarea {
  /* 高度随窗口高度变化，使用 vh。实现垂直方向的等比例缩放感 */
  height: clamp(80px, 15vh, 400px);
  
  /* 内部间距保持 px/rem (由原 Tailwind class p-3 提供)，满足“间距不变” */
  /* 如果需要完全控制，可以在这里显式写 padding: 12px; */
}

/* 如果需要强制等比例（比如 16:4 的盒子），可以启用 aspect-ratio */
/* .responsive-input-container { aspect-ratio: 16 / 4; } */
</style>
