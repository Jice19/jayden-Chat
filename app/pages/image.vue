<template>
  <div class="flex h-screen w-full bg-gray-50 overflow-hidden">
    <!-- 侧边栏 -->
    <div class="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      <div class="p-4 border-b border-gray-100 space-y-3">
        <NuxtLink
          to="/"
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          ← 返回聊天
        </NuxtLink>
        <div class="flex justify-center pt-2">
          <ThemeToggle />
        </div>
      </div>

      <!-- 历史记录列表 -->
      <div class="flex-1 overflow-y-auto p-2 space-y-2">
        <p class="text-xs text-gray-400 px-2 pt-2">历史记录（{{ total }}）</p>

        <div v-if="isLoadingHistory && history.length === 0" class="text-center py-8">
          <p class="text-gray-400 text-sm">加载中...</p>
        </div>

        <div
          v-for="item in history"
          :key="item.id"
          class="cursor-pointer rounded-lg overflow-hidden border transition-colors"
          :class="selected?.id === item.id ? 'border-blue-400' : 'border-gray-100 hover:border-blue-200'"
          @click="selected = item"
        >
          <img :src="item.url" class="w-full h-24 object-cover" alt="generated" />
          <div class="p-2 text-xs text-gray-500 truncate">{{ item.prompt }}</div>
        </div>

        <div v-if="history.length === 0 && !isLoadingHistory" class="text-center py-8">
          <p class="text-gray-400 text-sm">暂无生成记录</p>
        </div>

        <button
          v-if="history.length < total"
          @click="loadMore"
          :disabled="isLoadingHistory"
          class="w-full py-2 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          {{ isLoadingHistory ? '加载中...' : '加载更多' }}
        </button>
      </div>
    </div>

    <!-- 主区域 -->
    <div class="flex-1 flex flex-col h-full">
      <!-- 图片展示区 -->
      <div class="flex-1 flex items-center justify-center p-8 overflow-hidden">
        <div v-if="isGenerating" class="flex flex-col items-center gap-4 text-gray-500">
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
            <p class="text-sm text-gray-600">{{ selected.prompt }}</p>
            <p class="text-xs text-gray-400">{{ selected.size }} · {{ new Date(selected.createdAt).toLocaleTimeString() }}</p>
          </div>
          <a
            :href="selected.url"
            target="_blank"
            download
            class="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors"
          >
            下载图片
          </a>
        </div>

        <div v-else class="flex flex-col items-center gap-3 text-gray-300">
          <svg class="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p class="text-sm">输入描述词，开始生成图片</p>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="bg-white border-t border-gray-200 p-4">
        <div class="max-w-3xl mx-auto space-y-3">
          <!-- 参数选项 -->
          <div class="flex gap-3 items-center flex-wrap">
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <label>尺寸</label>
              <select
                v-model="size"
                class="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1024*1024">1024×1024（方图）</option>
                <option value="1280*720">1280×720（横版）</option>
                <option value="720*1280">720×1280（竖版）</option>
                <option value="1280*1280">1280×1280（大方图）</option>
              </select>
            </div>
            <label class="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" v-model="promptExtend" class="rounded" />
              智能扩写提示词
            </label>
          </div>

          <!-- 负向提示词 -->
          <input
            v-model="negativePrompt"
            type="text"
            placeholder="负向提示词（可选）：模糊、低质量..."
            class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <!-- 主输入框 -->
          <div class="relative">
            <textarea
              v-model="prompt"
              class="w-full border border-gray-300 rounded-xl p-3 pr-24 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none shadow-sm"
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

          <div class="text-xs text-gray-400 px-1">
            Powered by qwen-image-2.0 · 图片链接 24 小时有效
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useImageGen } from '~/composables/useImageGen'
import type { ImageGenResult } from '../../types/image'

const { isGenerating, isLoadingHistory, history, total, loadHistory, generate } = useImageGen()

const currentPage = ref(1)
const loadMore = async () => {
  currentPage.value++
  await loadHistory(currentPage.value)
}

onMounted(() => loadHistory(1))

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
