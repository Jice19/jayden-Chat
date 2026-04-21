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
          to="/image"
          class="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>🎨</span> AI 图片生成
        </NuxtLink>
        <div class="flex justify-center pt-2">
          <ThemeToggle />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-3 space-y-4">
        <div class="px-2 text-xs text-[var(--color-text-disabled)] font-medium">技术特性</div>
        <div class="px-3 py-2 rounded-lg bg-[var(--color-hover)] text-xs text-[var(--color-text-secondary)] leading-relaxed space-y-2">
          <p>• 只渲染可视区域元素</p>
          <p>• 动态高度校正</p>
          <p>• requestAnimationFrame 优化</p>
          <p>• 支持复杂列表项</p>
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
    <div class="flex-1 overflow-y-auto bg-[var(--color-background)] p-8">
      <div class="max-w-4xl mx-auto">
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-[var(--color-text-primary)] mb-4">虚拟列表演示</h1>
          <p class="text-[var(--color-text-secondary)] mb-6">
            这个演示展示了虚拟列表技术如何优化长列表的渲染性能。通过只渲染可视区域内的元素，
            我们可以处理包含数万个项目的列表而不会造成性能问题。
          </p>
          
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 class="text-lg font-semibold text-blue-900 mb-2">性能优化说明</h3>
            <ul class="text-blue-800 space-y-1">
              <li>• 只渲染可视区域内的元素（约15-20个）</li>
              <li>• 使用动态高度校正来准确计算滚动位置</li>
              <li>• 通过requestAnimationFrame优化滚动性能</li>
              <li>• 支持包含图片的复杂列表项</li>
            </ul>
          </div>
        </div>
        
        <VirtualListDemo />
        
        <div class="mt-8 bg-[var(--color-surface)] rounded-lg shadow-sm border border-[var(--color-border)] p-6">
          <h2 class="text-xl font-semibold text-[var(--color-text-primary)] mb-4">技术实现</h2>
          <div class="grid md:grid-cols-2 gap-6">
            <div>
              <h3 class="text-lg font-medium text-[var(--color-text-primary)] mb-2">核心原理</h3>
              <ul class="text-[var(--color-text-secondary)] space-y-1">
                <li>• 使用绝对定位创建虚拟滚动容器</li>
                <li>• 通过transform实现内容偏移</li>
                <li>• 动态计算可视范围的起始索引</li>
                <li>• 使用二分查找优化索引计算</li>
              </ul>
            </div>
            <div>
              <h3 class="text-lg font-medium text-[var(--color-text-primary)] mb-2">性能监控</h3>
              <ul class="text-[var(--color-text-secondary)] space-y-1">
                <li>• 实时FPS监控</li>
                <li>• 渲染元素数量统计</li>
                <li>• 滚动位置追踪</li>
                <li>• 内存使用优化</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAvatar } from '~/composables/useAvatar'
import { useAuth } from '~/composables/useAuth'

const { userAvatar, isUploading: isUploadingAvatar, uploadError, uploadAvatar } = useAvatar()
const { user: authUser, logout } = useAuth()

const onAvatarChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  await uploadAvatar(file)
  // 清空 input，允许重复选同一文件
  ;(e.target as HTMLInputElement).value = ''
}
</script>
