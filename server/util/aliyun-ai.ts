import { getApiKey } from './get-api-key'

// 封装阿里云通义千问 API 调用逻辑（使用全局 API Key）
// 支持流式和非流式调用
export async function callAliyunAI(
  prompt: string,
  history: Array<{ role: string, content: string }> = [],
  stream = false
) {
  // 1. 优先用 Vercel 系统变量判断，避免 NODE_ENV 误判
  const isVercelEnv = typeof process.env.VERCEL !== 'undefined' && process.env.VERCEL === '1'
  const isProductionEnv = process.env.NODE_ENV === 'production'
  const useIntlEndpoint = isVercelEnv || isProductionEnv

  // 2. 强制日志输出，方便线上排查
  console.log('[DashScope Endpoint Check][chat]', {
    VERCEL: process.env.VERCEL,
    NODE_ENV: process.env.NODE_ENV,
    useIntlEndpoint
  })

  // 3. 明确指定端点
  const endpoint = useIntlEndpoint
    ? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions'
    : 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

  // 4. 其他逻辑保持不变
  const apiKey = getApiKey()
  const modelName = 'qwen3.6-plus'

  // 构建消息列表：历史记录 + 当前提问
  const messages = [
    { role: 'system', content: '你是一个乐于助人的 AI 助手。' },
    ...history,
    { role: 'user', content: prompt }
  ]

  // 请求体
  const body = {
    model: modelName,
    messages: messages,
    temperature: 0.7,
    top_p: 0.8,
    max_tokens: 2000,
    stream: stream // 核心：是否开启流式
  }

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Accept': stream ? 'text/event-stream' : 'application/json'
  }

  try {
    // 3. 调用阿里云 AI API
    // 注意：如果是流式，我们需要返回原生 Response 对象以便后续处理
    if (stream) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })
      
      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`)
      }
      
      return response.body // 返回 ReadableStream
    } else {
      // 非流式调用（保持原有逻辑）
      const response = await $fetch<{
        choices?: Array<{
          message?: {
            content?: string
          }
        }>
      }>(endpoint, {
        method: 'POST',
        headers,
        body
      })

      const aiReply = response.choices?.[0]?.message?.content
      if (!aiReply) {
        throw new Error('AI 回复为空，返回格式：' + JSON.stringify(response))
      }
      return aiReply
    }
  } catch (error) {
    const errorMsg = (error as Error).message
    console.error('阿里云 AI 调用失败：', errorMsg)
    throw new Error(`AI 回复生成失败：${errorMsg}`)
  }
}
