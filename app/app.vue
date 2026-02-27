<template>
  <!-- 整体布局：全屏 Flex -->
  <div class="flex h-screen w-full bg-gray-50">
    <!-- 侧边栏：历史记录（固定宽度） -->
    <div class="w-64 bg-white border-r border-gray-200 p-4">
      <h2 class="text-lg font-bold text-gray-800 mb-4">对话历史</h2>
      <!-- 历史对话列表（从数据库加载） -->
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
      <!-- 空状态提示 -->
      <div v-else class="text-gray-400 text-sm mt-2">暂无对话记录</div>
    </div>

    <!-- 主内容区：对话 + 输入 -->
    <div class="flex-1 flex flex-col">
      <!-- 对话展示区（占满剩余高度） -->
      <div class="flex-1 p-6 overflow-auto">
        <div 
          v-for="(item, index) in chatList" 
          :key="index" 
          class="mb-4 max-w-3xl"
          :class="item.isUser ? 'ml-auto' : 'mr-auto'"
        >
          <!-- 用户消息 -->
          <div v-if="item.isUser" class="bg-blue-500 text-white p-4 rounded-lg shadow">
            {{ item.content }}
          </div>
          <!-- AI 消息 -->
          <div v-else class="bg-white text-gray-800 p-4 rounded-lg shadow border border-gray-200">
            {{ item.content }}
          </div>
        </div>
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
            :disabled="!inputText.valueOf()"
            class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
import { ref, onMounted } from 'vue'

// 定义对话消息类型（匹配数据库模型）
interface ChatMessage {
  id?: string
  content: string
  isUser: boolean
  createdAt?: string
}

// 响应式数据：输入内容 + 对话列表
const inputText = ref('')
const chatList = ref<ChatMessage[]>([])

// 页面加载时：从数据库加载历史对话（添加完整校验）
onMounted(async () => {
  try {
    // 调用获取历史对话的接口
    const res = await $fetch('/api/chat/list')
    
    // 第一层校验：接口返回是否正常
    if (!res || typeof res !== 'object') {
      console.error('接口返回格式异常：', res)
      return
    }

    // 第二层校验：接口返回成功且有数据
    if (res.success && Array.isArray(res.data)) {
      // 第三层校验：过滤空内容的消息，避免 trim() 报错
      const validChats = res.data.filter(item => {
        return item && typeof item.content === 'string' 
      })
      chatList.value = validChats
    }
  } catch (error) {
    console.error('加载历史对话失败：', error)
    // 只提示，不阻断页面加载
    // alert('加载历史对话失败，请检查接口是否正常～')
  }
})

// 发送消息函数（存入数据库 + 显示到界面）
const sendMessage = async () => {
  // 空消息不发送（提前校验）
  const userContent = inputText.value
  if (!userContent) return

  // 清空输入框
  inputText.value = ''

  try {
    // 调用接口保存用户消息到 PostgreSQL
    const res = await $fetch('/api/chat/save', {
      method: 'POST',
      body: {
        content: userContent,
        isUser: true // 标记为用户消息
      }
    })

    // 校验接口返回
    if (!res || !res.success) {
      console.error('保存用户消息失败：', res?.message)
      return
    }

    // 添加用户消息到界面（校验数据）
    if (res.data && typeof res.data.content === 'string') {
      chatList.value.push({
        id: res.data.id,
        content: res.data.content,
        isUser: true,
        createdAt: res.data.createdAt
      })
    }

    // 模拟 AI 回复（后续可替换为真实 AI 接口）
    setTimeout(async () => {
      const aiContent = `你问的是：${userContent}\n这是 AI 模拟回复～`
      
      // 保存 AI 回复到数据库
      const aiRes = await $fetch('/api/chat/save', {
        method: 'POST',
        body: {
          content: aiContent,
          isUser: false // 标记为 AI 消息
        }
      })

      // 添加 AI 回复到界面（校验数据）
      if (aiRes?.success && aiRes.data && typeof aiRes.data.content === 'string') {
        chatList.value.push({
          id: aiRes.data.id,
          content: aiRes.data.content,
          isUser: false,
          createdAt: aiRes.data.createdAt
        })
        
        // 自动滚动到最新消息
        scrollToBottom()
      }
    }, 500)

    // 自动滚动到最新消息
    scrollToBottom()
  } catch (error) {
    console.error('发送消息失败：', error)
    // 只打印错误，不弹框影响使用
    // alert('发送消息失败，请检查接口是否正常～')
  }
}

// 自动滚动到最新消息（体验优化）
const scrollToBottom = () => {
  // 加延迟，确保 DOM 已更新
  setTimeout(() => {
    const chatContainer = document.querySelector('.overflow-auto')
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight
    }
  }, 100)
}
</script>