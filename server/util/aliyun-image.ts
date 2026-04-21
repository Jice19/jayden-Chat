import type { ImageGenRequest, ImageGenResult } from '../../types/image'
import { getApiKey } from './get-api-key'

const MODEL = 'qwen-image-2.0'

export async function generateImage(req: ImageGenRequest): Promise<ImageGenResult> {
  // 1. 优先用 Vercel 系统变量判断，避免 NODE_ENV 误判
  const isVercelEnv = typeof process.env.VERCEL !== 'undefined' && process.env.VERCEL === '1'
  const isProductionEnv = process.env.NODE_ENV === 'production'
  const useIntlEndpoint = isVercelEnv || isProductionEnv

  // 2. 强制日志输出，方便线上排查
  console.log('[DashScope Endpoint Check][image]', {
    VERCEL: process.env.VERCEL,
    NODE_ENV: process.env.NODE_ENV,
    useIntlEndpoint
  })

  // 3. 明确指定端点
  const endpoint = useIntlEndpoint
    ? 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
    : 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'

  // 4. 其他逻辑保持不变
  const apiKey = getApiKey()
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
