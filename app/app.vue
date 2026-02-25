<template>
  <!-- 整体布局：全屏 Flex -->
  <div class="flex h-screen w-full bg-gray-50">
    <!-- 侧边栏：历史记录（固定宽度） -->
    <div class="w-64 bg-white border-r border-gray-200 p-4">
      <h2 class="text-lg font-bold text-gray-800 mb-4">对话历史</h2>
      <!-- 空状态提示 -->
      <div class="text-gray-400 text-sm mt-2">暂无对话记录</div>
    </div>

    <!-- 主内容区：对话 + 输入 -->
    <div class="flex-1 flex flex-col">
      <!-- 对话展示区（占满剩余高度） -->
      <div class="flex-1 p-6 overflow-auto">
          <ChatItem 
            v-for="(item, index) in chatList" 
            :key="index" 
            :isUser="item.isUser"
          >
            {{ item.content }}
          </ChatItem>
        </div>

      <!-- 输入区（固定底部） -->
      <div class="bg-white border-t border-gray-200 p-4">
        <!-- 输入框 + 发送按钮 -->
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
              class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              发送
            </button>
        </div>
        <!-- 文生图入口按钮 -->
        <button class="mt-2 text-blue-500 hover:text-blue-600 text-sm">
          🖼️ 生成图片
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// 响应式数据：输入内容 + 对话列表
const inputText = ref('')
const chatList = ref<Array<{ isUser: boolean; content: string }>>([
  { isUser: true, content: '你好，我是用户' },
  { isUser: false, content: '这是 AI 回复～\n```javascript\nconsole.log("简版豆包代码高亮测试");\n```' }
])

// 发送消息函数
const sendMessage = () => {
  if (!inputText.value.trim()) return
  
  // 1. 添加用户消息到列表
  chatList.value.push({ isUser: true, content: inputText.value.trim() })
  // 2. 模拟 AI 回复（后续替换为真实 API 调用）
  setTimeout(() => {
    chatList.value.push({
      isUser: false,
      content: `你问的是：${inputText.value}\n这是 AI 模拟回复～`
    })
  }, 500)
  // 3. 清空输入框
  inputText.value = ''
}
</script>