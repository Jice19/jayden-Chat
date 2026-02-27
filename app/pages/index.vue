<template>
  <div class="flex h-screen w-full bg-gray-50">
    <div class="w-64 bg-white border-r border-gray-200 p-4">
      <h2 class="text-lg font-bold text-gray-800 mb-4">对话历史</h2>
      <div v-if="chatList.length > 0" class="space-y-2">
        <div 
          v-for="(item, index) in chatList" 
          :key="index" 
          class="text-sm p-2 rounded hover:bg-gray-100 truncate"
        >
          <span class="text-gray-500">{{ item.isUser ? '我：' : 'AI：' }}</span>
          {{ item.content }}
        </div>
      </div>
      <div v-else class="text-gray-400 text-sm mt-2">暂无对话记录</div>
    </div>

    <div class="flex-1 flex flex-col">
      <div class="flex-1 p-6 overflow-auto">
        <ChatItem
          v-for="(item, index) in chatList" 
          :key="index" 
          class="mb-4 max-w-3xl"
          :class="item.isUser ? 'ml-auto' : 'mr-auto'"
          :is-user="item.isUser"
        >
          {{ item.content }}
        </ChatItem>
      </div>

      <div class="bg-white border-t border-gray-200 p-4">
        <div class="flex gap-2">
          <textarea 
            v-model="inputText"
            class="flex-1 border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="输入你的问题..."
            rows="3"
            @keyup.enter="sendMessage"
          ></textarea>
          <button 
            @click="sendMessage"
            :disabled="!inputText.valueOf()"
            class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            发送
          </button>
        </div>
        <button class="mt-2 text-blue-500 hover:text-blue-600 text-sm">
          🖼️ 生成图片
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { inputText, chatList, sendMessage } = useChat()
</script>
