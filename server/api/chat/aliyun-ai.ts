// server/utils/aliyun-ai.ts
export async function callAliyunAI(prompt: string) {
  // 读取全局环境变量（变量名必须和你全局配置的完全一致！）
  // 比如你全局变量名叫「ALIYUN_API_KEY」，就写 process.env.ALIYUN_API_KEY
  const apiKey = process.env.ALIYUN_API_KEY // 全局变量名
  // 接口地址和模型名也可以设为全局，或直接写死（推荐写死，避免全局变量太多）
  const endpoint = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
  const modelName = 'qwen-plus'

  // 校验全局变量是否存在
  if (!apiKey) {
    throw new Error('全局环境变量 ALIYUN_API_KEY 未配置！请检查全局变量名是否正确')
  }

  try {
    // 调用 OpenAI 兼容接口（适配阿里云百炼）
    const response = await $fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: {
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      }
    })

    // 解析 OpenAI 兼容格式的返回结果
    return response.choices?.[0]?.message?.content || '暂无回复'
  } catch (error) {
    console.error('调用阿里云 AI 失败：', error)
    throw new Error('AI 回复生成失败：' + (error as Error).message)
  }
}