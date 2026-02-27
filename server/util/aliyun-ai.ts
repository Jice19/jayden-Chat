// 封装阿里云通义千问 API 调用逻辑（使用全局 API Key）
export async function callAliyunAI(prompt: string, history: Array<{ role: string, content: string }> = []) {
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

  try {
    // 3. 调用阿里云 AI API（OpenAI 兼容格式）
    const response = await $fetch<{
      choices?: Array<{
        message?: {
          content?: string
        }
      }>
    }>(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`, // 核心：使用全局 API Key 认证
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: {
        model: modelName, // 指定调用的模型
        messages: messages,
        temperature: 0.7, // 回复随机性（0-1，越小越稳定）
        top_p: 0.8,
        max_tokens: 2000 // 最大回复长度
      }
    })

    // 4. 解析 AI 回复结果（兼容 OpenAI 格式）
    const aiReply = response.choices?.[0]?.message?.content
    if (!aiReply) {
      throw new Error('AI 回复为空，返回格式：' + JSON.stringify(response))
    }
    return aiReply
  } catch (error) {
    const errorMsg = (error as Error).message
    console.error('阿里云 AI 调用失败：', errorMsg)
    throw new Error(`AI 回复生成失败：${errorMsg}`)
  }
}
