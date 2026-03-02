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
          to="/virtual-list-demo"
          class="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>🚀</span> 虚拟列表演示
        </NuxtLink>
      </div>
      
      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        <div 
          v-for="session in sessionList" 
          :key="session.id"
          @click="switchSession(session.id)"
          class="p-3 rounded-lg cursor-pointer text-sm transition-colors border border-transparent"
          :class="[
            currentSessionId === session.id 
              ? 'bg-blue-50 text-blue-700 border-blue-100' 
              : 'text-gray-700 hover:bg-gray-100 hover:border-gray-200'
          ]"
        >
          <div class="font-medium truncate">{{ session.title || '新会话' }}</div>
          <div class="text-xs text-gray-400 mt-1">
             {{ new Date(session.createdAt).toLocaleDateString() }} {{ new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
          </div>
        </div>
        
        <div v-if="sessionList.length === 0" class="text-center py-8">
           <p class="text-gray-400 text-sm">暂无历史会话</p>
        </div>
      </div>
    </div>

    <!-- 主聊天区域 -->
    <div class="flex-1 flex flex-col h-full relative">
      <!-- 消息列表 -->
      <div class="flex-1 overflow-auto p-4 scroll-smooth">
        <div v-if="chatList.length === 0" class="h-full flex flex-col items-center justify-center text-gray-300">
          <div class="text-4xl mb-2">👋</div>
          <p>有什么可以帮你的吗？</p>
        </div>
        
        <div v-else class="max-w-4xl mx-auto w-full pb-4 h-full">
          <ChatVirtualList
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
                @click="isSending ? abortSend() : sendMessage()"
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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useChat } from '~/composables/useChat'

const { 
  inputText, 
  chatList, 
  isSending, 
  sendMessage, 
  abortSend,
  sessionList,
  currentSessionId,
  createNewSession,
  switchSession
} = useChat()

const isComposing = ref(false)

const onEnterSend = () => {
  if (isComposing.value) return
  if (isSending.value) return
  sendMessage()
}
</script>
