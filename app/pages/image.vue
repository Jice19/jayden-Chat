<template>
  <div class="flex h-screen w-full bg-[var(--color-background)] overflow-hidden">
    <!-- 侧边栏 -->
    <div class="w-64 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col flex-shrink-0">
      <div class="p-4 border-b border-[var(--color-border)] space-y-3">
        <NuxtLink
          to="/"
          class="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>✨</span> 统一智能助手
        </NuxtLink>
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
          to="/virtual-list-demo"
          class="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>🚀</span> 虚拟列表演示
        </NuxtLink>
        <div class="flex justify-center pt-2">
          <ThemeToggle />
        </div>
      </div>

      <!-- 历史记录列表 -->
      <div class="flex-1 overflow-y-auto p-2 space-y-2">
        <p class="text-xs text-[var(--color-text-disabled)] px-2 pt-2">历史记录（{{ total }}）</p>

        <div v-if="isLoadingHistory && history.length === 0" class="text-center py-8">
          <p class="text-[var(--color-text-disabled)] text-sm">加载中...</p>
        </div>

        <div
          v-for="item in history"
          :key="item.id"
          class="cursor-pointer rounded-lg overflow-hidden border transition-colors"
          :class="selected?.id === item.id ? 'border-blue-400' : 'border-[var(--color-border)] hover:border-blue-200'"
          @click="selected = item"
        >
          <img :src="item.url" class="w-full h-24 object-cover" alt="generated" />
          <div class="p-2 text-xs text-[var(--color-text-secondary)] truncate">{{ item.prompt }}</div>
        </div>

        <div v-if="history.length === 0 && !isLoadingHistory" class="text-center py-8">
          <p class="text-[var(--color-text-disabled)] text-sm">暂无生成记录</p>
        </div>

        <button
          v-if="history.length < total"
          @click="loadMore"
          :disabled="isLoadingHistory"
          class="w-full py-2 text-xs text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)] disabled:opacity-50"
        >
          {{ isLoadingHistory ? '加载中...' : '加载更多' }}
        </button>
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
            <p v-else-if="isUploadingAvatar" class="text-xs text-blue-500">上传中...</p>
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
    <div class="flex-1 flex flex-col h-full bg-[var(--color-background)]">
      <!-- 图片展示区 -->
      <div class="flex-1 flex items-center justify-center p-8 overflow-hidden">
        <div v-if="isGenerating" class="flex flex-col items-center gap-4 text-[var(--color-text-secondary)]">
          <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p class="text-sm">正在生成图片，请稍候（约 10-30 秒）...</p>
        </div>

        <div v-else-if="selected" class="flex flex-col items-center gap-4 max-h-full">
          <img
            :src="selected.url"
            class="max-w-full max-h-[60vh] rounded-2xl shadow-lg object-contain"
            alt="generated image"
          />
          <div class="text-center space-y-1">
            <p class="text-sm text-[var(--color-text-primary)]">{{ selected.prompt }}</p>
            <p class="text-xs text-[var(--color-text-disabled)]">{{ selected.size }} · {{ new Date(selected.createdAt).toLocaleTimeString() }}</p>
          </div>
          <a
            :href="selected.url"
            target="_blank"
            download
            class="px-4 py-1.5 bg-[var(--color-surface)] hover:bg-[var(--color-hover)] text-[var(--color-text-primary)] text-sm rounded-lg transition-colors border border-[var(--color-border)]"
          >
            下载图片
          </a>
        </div>

        <div v-else class="flex flex-col items-center gap-3 text-[var(--color-text-disabled)]">
          <svg class="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p class="text-sm">输入描述词，开始生成图片</p>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="bg-[var(--color-surface)] border-t border-[var(--color-border)] p-4">
        <div class="max-w-3xl mx-auto space-y-3">
          <!-- 参数选项 -->
          <div class="flex gap-3 items-center flex-wrap">
            <div class="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <label>尺寸</label>
              <select
                v-model="size"
                class="border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1024*1024">1024×1024（方图）</option>
                <option value="1280*720">1280×720（横版）</option>
                <option value="720*1280">720×1280（竖版）</option>
                <option value="1280*1280">1280×1280（大方图）</option>
              </select>
            </div>
            <label class="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] cursor-pointer">
              <input type="checkbox" v-model="promptExtend" class="rounded border-[var(--color-border)] bg-[var(--color-background)]" />
              智能扩写提示词
            </label>
          </div>

          <!-- 负向提示词 -->
          <input
            v-model="negativePrompt"
            type="text"
            placeholder="负向提示词（可选）：模糊、低质量..."
            class="w-full border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <!-- 主输入框 -->
          <div class="relative">
            <textarea
              v-model="prompt"
              class="w-full bg-[var(--color-background)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-xl p-3 pr-24 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none shadow-sm"
              placeholder="描述你想要的图片... (Enter 发送，Shift+Enter 换行)"
              rows="3"
              @keydown.enter.exact.prevent="onSubmit"
            ></textarea>
            <div class="absolute bottom-3 right-3">
              <button
                @click="onSubmit"
                :disabled="isGenerating || !prompt.trim()"
                class="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {{ isGenerating ? '生成中...' : '生成' }}
              </button>
            </div>
          </div>

          <div class="text-xs text-[var(--color-text-disabled)] px-1">
            Powered by qwen-image-2.0 · 图片链接 24 小时有效
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useImageGen } from '~/composables/useImageGen'
import { useAuth } from '~/composables/useAuth'
import { useAvatar } from '~/composables/useAvatar'
import type { ImageGenResult } from '../../types/image'

const { isGenerating, isLoadingHistory, history, total, loadHistory, generate } = useImageGen()
const { userAvatar, isUploading: isUploadingAvatar, uploadError, uploadAvatar } = useAvatar()
const { user: authUser, logout, isLoggedIn } = useAuth()

const onAvatarChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  await uploadAvatar(file)
  // 清空 input，允许重复选同一文件
  ;(e.target as HTMLInputElement).value = ''
}

const currentPage = ref(1)
const loadMore = async () => {
  currentPage.value++
  await loadHistory(currentPage.value)
}

// 等登录完成后再加载，与 useChat 保持一致
watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) loadHistory(1)
}, { immediate: true })

const prompt = ref('')
const negativePrompt = ref('')
const size = ref<'1024*1024' | '1280*720' | '720*1280' | '1280*1280'>('1024*1024')
const promptExtend = ref(true)
const selected = ref<ImageGenResult | null>(null)

const onSubmit = async () => {
  if (isGenerating.value || !prompt.value.trim()) return
  const result = await generate({
    prompt: prompt.value.trim(),
    size: size.value,
    negativePrompt: negativePrompt.value.trim() || undefined,
    promptExtend: promptExtend.value
  })
  if (result) selected.value = result
}
</script>
