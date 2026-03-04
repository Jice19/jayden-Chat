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
          to="/virtual-list-demo"
          class="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
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
import ChatVirtualList from '~/components/ChatVirtualList.vue' // 导入 ChatVirtualList 组件类型
import ConfirmModal from '~/components/ConfirmModal.vue' // 导入 ConfirmModal 组件

const chatVirtualListRef = ref<InstanceType<typeof ChatVirtualList> | null>(null)
const confirmModalRef = ref<InstanceType<typeof ConfirmModal> | null>(null)

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
