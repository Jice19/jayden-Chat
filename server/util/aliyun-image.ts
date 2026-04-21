import type { ImageGenRequest, ImageGenResult } from '../../types/image'
import { getApiKey } from './get-api-key'

const ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
const MODEL = 'qwen-image-2.0'

export async function generateImage(req: ImageGenRequest): Promise<ImageGenResult> {
  const apiKey = getApiKey()
  
  // 自动根据环境选择 Endpoint，解决 Vercel 海外访问国内节点的网络拦截问题
  const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
  const endpoint = isVercel 
    ? 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
    : 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'

  const size = req.size ?? '1024*1024'

  const body = {
    model: MODEL,
    input: {
      messages: [
        {
          role: 'user',
          content: [{ text: req.prompt }]
        }
      ]
    },
    parameters: {
      size,
      prompt_extend: req.promptExtend ?? true,
      watermark: false,
      ...(req.negativePrompt ? { negative_prompt: req.negativePrompt } : {})
    }
  }

  const response = await $fetch<{
    output?: {
      choices?: Array<{
        finish_reason: string
        message: {
          role: string
          content: Array<{ image?: string; text?: string }>
        }
      }>
    }
  }>(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body,
    timeout: 120000 // 图像生成最长等 120s
  })

  const imageUrl = response.output?.choices?.[0]?.message?.content?.[0]?.image
  if (!imageUrl) {
    throw new Error('图片生成失败，API 未返回图片 URL，原始响应：' + JSON.stringify(response))
  }

  return {
    url: imageUrl,
    prompt: req.prompt,
    size,
    createdAt: new Date().toISOString()
  }
}
