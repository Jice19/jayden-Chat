import { ref, onMounted, nextTick } from 'vue'
import { useApi } from './useApi'
import type { ApiResult, AiReplyResult } from '../../types/api'
import type { ChatMessage } from '../../types/chat'

export const useChat = () => {
  const inputText = ref('')
  const chatList = ref<ChatMessage[]>([])
  const api = useApi()

  const scrollToBottom = () => {
    nextTick(() => {
      setTimeout(() => {
        const chatContainer = document.querySelector('.overflow-auto')
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight
        }
      }, 100)
    })
  }

  const loadChatList = async () => {
    try {
      const res = (await api.get<ApiResult<ChatMessage[]>>('/chat/list')) as unknown as ApiResult<ChatMessage[]>

      if (!res || typeof res !== 'object') {
        console.error('接口返回格式异常：', res)
        return
      }

      if (res.success && Array.isArray(res.data)) {
        const validChats = res.data.filter((item: ChatMessage) => {
          return item && typeof item.content === 'string'
        })
        chatList.value = validChats
      }
    } catch (error) {
      console.error('加载历史对话失败：', error)
    }
  }

  const saveMessage = async (content: string, isUser: boolean) => {
    try {
      const res = (await api.post<ApiResult<ChatMessage>>('/chat/save', {
        content,
        isUser
      })) as unknown as ApiResult<ChatMessage>

      if (!res || !res.success) {
        console.error('保存消息失败：', res?.message)
        return null
      }

      if (res.data && typeof res.data.content === 'string') {
        return {
          id: res.data.id,
          content: res.data.content,
          isUser: res.data.isUser,
          createdAt: res.data.createdAt
        } as ChatMessage
      }

      return null
    } catch (error) {
      console.error('保存消息失败：', error)
      return null
    }
  }

  const sendMessage = async () => {
    const userContent = inputText.value
    if (!userContent || userContent.trim() === '') return

    inputText.value = ''

    const savedUser = await saveMessage(userContent, true)
    if (savedUser) {
      chatList.value.push(savedUser)
      scrollToBottom()
    }

    try {
      const aiRes = (await api.post<AiReplyResult>('/chat/ai-reply', {
        prompt: userContent
      })) as unknown as AiReplyResult

      if (!aiRes || !aiRes.success || typeof aiRes.reply !== 'string') {
        console.error('AI 回复生成失败：', aiRes?.message)
        return
      }

      const savedAi = await saveMessage(aiRes.reply, false)
      if (savedAi) {
        chatList.value.push(savedAi)
        scrollToBottom()
      }
    } catch (error) {
      console.error('AI 回复生成失败：', error)
    }
  }

  onMounted(loadChatList)

  return {
    inputText,
    chatList,
    sendMessage
  }
}
