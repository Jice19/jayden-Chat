<template>
  <div class="flex h-screen w-full bg-gray-50 overflow-hidden">
    <!-- 侧边栏：会话列表 -->
    <div class="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      <div class="p-4 border-b border-gray-100 space-y-3">
        <button 
          @click="createNewSession"
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>+</span> 新建对话
        </button>
        <NuxtLink
          to="/image"
          class="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>🎨</span> AI 图片生成
        </NuxtLink>
        <NuxtLink
          to="/unified"
          class="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>✨</span> 统一智能助手
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
      
      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        <div 
            v-for="session in sessionList" 
            :key="session.id"
            class="group p-3 rounded-lg cursor-pointer text-sm transition-colors border border-transparent flex items-center justify-between"
            :class="[
              currentSessionId === session.id 
                ? 'bg-blue-50 text-blue-700 border-blue-100' 
                : 'text-gray-700 hover:bg-gray-100 hover:border-gray-200'
            ]"
          >
            <div @click="switchSessionAndScroll(session.id)" class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ session.title || '新会话' }}</div>
              <div class="text-xs text-gray-400 mt-1">
                {{ new Date(session.createdAt).toLocaleDateString() }} {{ new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
              </div>
            </div>
            <button 
              @click="handleDeleteSession(session.id, $event)"
              class="ml-2 p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              title="删除会话"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 11-2 0v6a1 1 0 112 0V8z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        
        <div v-if="sessionList.length === 0" class="text-center py-8">
           <p class="text-gray-400 text-sm">暂无历史会话</p>
        </div>
      </div>

      <!-- 用户信息区 -->
      <div class="p-4 border-t border-gray-100 flex-shrink-0">
        <div class="flex items-center gap-3">
          <!-- 头像（可点击上传） -->
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
          <!-- 用户名 + 上传状态 -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-700 truncate">{{ authUser?.username || '未登录' }}</p>
            <p v-if="uploadError" class="text-xs text-red-500 truncate">{{ uploadError }}</p>
            <p v-else-if="isUploading" class="text-xs text-blue-500">上传中...</p>
            <p v-else class="text-xs text-gray-400">{{ userAvatar ? '点击头像更换' : '点击头像上传' }}</p>
          </div>
          <!-- 退出按钮 -->
          <button
            @click="logout"
            title="退出登录"
            class="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 主聊天区域 -->
    <div class="flex-1 flex flex-col h-full relative">
        <!-- 加载指示器 -->
        <div v-if="isLoadingChat" class="absolute top-0 left-0 right-0 bg-blue-100 text-blue-700 p-2 text-center text-sm z-10">
          加载中...
        </div>
        <!-- 消息列表 -->
        <div class="flex-1 p-4 scroll-smooth" :class="{ 'pt-10': isLoadingChat }">
          <div v-if="chatList.length === 0 && !isLoadingChat" class="h-full flex flex-col items-center justify-center text-gray-300">
            <div class="text-4xl mb-2">👋</div>
            <p>有什么可以帮你的吗？</p>
          </div>
          
          <div v-else class="max-w-4xl mx-auto w-full pb-4 h-full">
            <ChatVirtualList
              ref="chatVirtualListRef"
              :messages="chatList"
              :auto-scroll="true"
              :user-avatar="userAvatar"
            />
          </div>
        </div>

        <!-- 输入框区域 -->
        <div class="bg-white border-t border-gray-200 p-4">
          <div class="max-w-4xl mx-auto w-full">
            <div class="relative">
              <textarea 
                v-model="inputText"
                class="w-full border border-gray-300 rounded-xl p-3 pr-24 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none shadow-sm"
                placeholder="输入你的问题... (Enter 发送, Shift+Enter 换行)"
                rows="3"
                @keydown.enter.exact.prevent="onEnterSend"
                @compositionstart="isComposing = true"
                @compositionend="isComposing = false"
              ></textarea>
              
              <div class="absolute bottom-3 right-3 flex gap-2">
                 <button 
                  @click="isSending ? abortSend() : sendMessageAndScroll()"
                  :disabled="(!inputText || !inputText.trim()) && !isSending"
                  class="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
                  :class="isSending 
                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed'"
                >
                  {{ isSending ? '停止' : '发送' }}
                </button>
              </div>
            </div>
            
            <div class="mt-2 flex justify-between items-center text-xs text-gray-400 px-1">
              <span>Powered by Gemini</span>
            </div>
          </div>
        </div>
      </div>
      <ConfirmModal ref="confirmModalRef" />
    </div>
  </template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useChat } from '~/composables/useChat'
import { useAvatar } from '~/composables/useAvatar'
import { useAuth } from '~/composables/useAuth'
import ChatVirtualList from '~/components/ChatVirtualList.vue'
import ConfirmModal from '~/components/ConfirmModal.vue'

const chatVirtualListRef = ref<InstanceType<typeof ChatVirtualList> | null>(null)
const confirmModalRef = ref<InstanceType<typeof ConfirmModal> | null>(null)

const { userAvatar, isUploading, uploadError, uploadAvatar } = useAvatar()
const { user: authUser, logout } = useAuth()

const onAvatarChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  await uploadAvatar(file)
  // 清空 input，允许重复选同一文件
  ;(e.target as HTMLInputElement).value = ''
}

const { 
  inputText, 
  chatList, 
  isSending, 
  isLoadingChat, // 引入加载状态
  sendMessage: originalSendMessage, // 重命名原始的 sendMessage
  abortSend,
  sessionList,
  currentSessionId,
  createNewSession,
  switchSession: originalSwitchSession, // 重命名原始的 switchSession
  deleteSession // 引入 deleteSession
} = useChat()

const isComposing = ref(false)

const switchSessionAndScroll = async (sessionId: string) => {
  await originalSwitchSession(sessionId)
  // 添加一个短暂的延迟，确保虚拟列表有时间渲染内容
  setTimeout(() => {
    chatVirtualListRef.value?.scrollToBottom()
  }, 100) 
}

const sendMessageAndScroll = async () => {
  await originalSendMessage()
  // 添加一个短暂的延迟，确保虚拟列表有时间渲染内容
  setTimeout(() => {
    chatVirtualListRef.value?.scrollToBottom()
  }, 100)
}

const handleDeleteSession = async (sessionId: string, event: MouseEvent) => {
  event.stopPropagation() // 阻止事件冒泡，避免触发会话切换
  const confirmed = await confirmModalRef.value?.show()
  if (confirmed) {
    await deleteSession(sessionId)
  }
}

const onEnterSend = () => {
  if (isComposing.value) return
  if (isSending.value) return
  sendMessageAndScroll()
}

onMounted(() => {
  // 确保在组件挂载后，如果 chatList 有内容，则滚动到底部
  if (chatList.value.length > 0) {
    nextTick(() => {
      chatVirtualListRef.value?.scrollToBottom()
    })
  }
})
</script>
