import { ref, onMounted, nextTick } from 'vue'
import { useApi } from './useApi'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import type { ApiResult, AiReplyResult } from '../../types/api'
import type { ChatMessage, Session } from '../../types/chat'

export const useChat = () => {
  const inputText = ref('')
  const chatList = ref<ChatMessage[]>([])
  const isSending = ref(false)
  const abortController = ref<AbortController | null>(null)
  const api = useApi()
  const fallbackReply = 'jayden-chat罢工啦～请稍后再试'

  // 会话管理状态
  const currentSessionId = ref<string | null>(null)
  const sessionList = ref<Session[]>([])

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

  const loadSessionList = async () => {
    try {
      const res = (await api.get<ApiResult<Session[]>>('/session/list')) as unknown as ApiResult<Session[]>
      if (res.success && Array.isArray(res.data)) {
        sessionList.value = res.data
      }
    } catch (error) {
      console.error('加载会话列表失败:', error)
    }
  }

  const switchSession = async (sessionId: string) => {
    if (currentSessionId.value === sessionId) return
    currentSessionId.value = sessionId
    await loadChatList()
    scrollToBottom()
  }

  const createNewSession = () => {
    currentSessionId.value = null
    chatList.value = []
  }

  const loadChatList = async () => {
    try {
      const url = currentSessionId.value 
        ? `/chat/list?sessionId=${currentSessionId.value}`
        : '/chat/list'
      
      const res = (await api.get<ApiResult<ChatMessage[]>>(url)) as unknown as ApiResult<ChatMessage[]>

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
        isUser,
        sessionId: currentSessionId.value
      })) as unknown as ApiResult<ChatMessage>

      if (!res || !res.success) {
        console.error('保存消息失败：', res?.message)
        return null
      }

      if (res.data && res.data.sessionId && !currentSessionId.value) {
        currentSessionId.value = res.data.sessionId
        loadSessionList()
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

  const abortSend = async () => {
    if (!abortController.value) return
    abortController.value.abort()
    abortController.value = null
    isSending.value = false
    const savedAi = await saveMessage(fallbackReply, false)
    if (savedAi) {
      chatList.value.push(savedAi)
      scrollToBottom()
    }
  }

  const sendMessage = async () => {
    if (isSending.value) return
    const userContent = inputText.value
    if (!userContent || userContent.trim() === '') return

    isSending.value = true
    const controller = new AbortController()
    abortController.value = controller
    inputText.value = ''

    const savedUser = await saveMessage(userContent, true)
    if (savedUser) {
      chatList.value.push(savedUser)
      scrollToBottom()
    }

    // 乐观更新：先在界面上显示一个空的 AI 消息
    const tempAiMsgId = Date.now().toString()
    const tempAiMsg = {
      id: tempAiMsgId,
      content: '', // 初始为空，后续流式追加
      isUser: false,
      createdAt: new Date().toISOString()
    }
    chatList.value.push(tempAiMsg)
    scrollToBottom()

    // 完整的 AI 回复内容，用于最后保存
    let fullReply = ''

    await fetchEventSource('/api/chat/ai-reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: userContent,
        sessionId: currentSessionId.value,
        stream: true // 开启流式
      }),
      signal: controller.signal,
      
      async onopen(response) {
        if (response.ok) {
          return // 连接成功
        } else {
          // 如果连接失败，抛出错误进入 onerror -> catch
          throw new Error(`连接失败: ${response.status}`)
        }
      },
      
      onmessage(msg) {
        // 处理 SSE 消息
        // 阿里云/OpenAI 格式: data: {"choices": [{"delta": {"content": "..."}}]}
        try {
          if (msg.data === '[DONE]') return
          
          const data = JSON.parse(msg.data)
          // 兼容 OpenAI 格式
          const content = data.choices?.[0]?.delta?.content || data.choices?.[0]?.message?.content || ''
          
          if (content) {
            fullReply += content
            // 实时更新界面
            const targetMsg = chatList.value.find(m => m.id === tempAiMsgId)
            if (targetMsg) {
              targetMsg.content = fullReply
              scrollToBottom()
            }
          }
        } catch (e) {
          console.error('解析 SSE 消息失败:', e)
        }
      },
      
      onclose() {
        // 结束时，保存完整的 AI 回复到数据库
        // 注意：这里需要处理空回复的情况
        if (!fullReply) return

        saveMessage(fullReply, false).then(savedAi => {
          if (savedAi) {
            // 用数据库返回的真实数据替换临时消息（主要为了更新 ID 和 createdAt）
            const index = chatList.value.findIndex(m => m.id === tempAiMsgId)
            if (index !== -1) {
              chatList.value[index] = savedAi
            }
          }
        })
      },
      
      onerror(err) {
        // fetchEventSource 的 onerror 如果不抛出错误，会自动重试
        // 我们不希望重试，所以直接抛出
        throw err 
      }
    }).catch(async (error) => {
      // 这里捕获 fetchEventSource 抛出的所有错误
      if (controller.signal.aborted) return
      
      console.error('AI 回复生成失败：', error)
      
      // 移除临时消息
      const index = chatList.value.findIndex(m => m.id === tempAiMsgId)
      if (index !== -1) {
        chatList.value.splice(index, 1)
      }
      
      // 显示并保存错误提示
      const savedAi = await saveMessage(fallbackReply, false)
      if (savedAi) {
        chatList.value.push(savedAi)
        scrollToBottom()
      }
    }).finally(() => {
      if (abortController.value === controller) {
        abortController.value = null
      }
      isSending.value = false
    })
  }

  onMounted(async () => {
    await loadSessionList()
    if (sessionList.value.length > 0 && sessionList.value[0]) {
      currentSessionId.value = sessionList.value[0].id
    }
    await loadChatList()
  })

  return {
    inputText,
    chatList,
    isSending,
    sendMessage,
    abortSend,
    currentSessionId,
    sessionList,
    createNewSession,
    switchSession
  }
}
