// 封装阿里云通义千问 API 调用逻辑（使用全局 API Key）
// 支持流式和非流式调用
export async function callAliyunAI(
  prompt: string, 
  history: Array<{ role: string, content: string }> = [],
  stream = false
) {
  // 1. 从 Nuxt 运行时配置读取全局变量
  const config = useRuntimeConfig()
  const rawKey = config.aliyunApiKey
  const apiKey = String(rawKey)
    .trim()
    .replace(/[“”]/g, '"')
    .replace(/^"+|"+$/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
  // 阿里云通义千问 OpenAI 兼容接口地址（固定）
  const endpoint = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
  // 模型名称
  const modelName = 'qwen-plus'

  // 2. 校验 API Key 是否存在
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('阿里云 API Key 未配置！请检查全局环境变量')
  }

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
