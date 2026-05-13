import type { UnifiedResponse } from '../../types/unified'
import { executeSkill } from '../skills/executor'

const IMAGE_KEYWORDS = [
  '生成图片', '生成图像', '生成一幅', '生成一张',
  '画一张', '画个', '帮我画', '画一幅',
  'create image', 'draw', '生成图', '画图', '来个头像', '画个图',
  '做张图', '做张图片', '生成个图', '生成一张图'
]
const TEXT_ONLY_KEYWORDS = [
  '什么是', '怎么做', '为什么', '告诉我', '分析', '比较',
  '区别', '推荐', '介绍', '讲解', '回答我', '解释一下',
  '含义是什么', '工作原理', '怎么用', '如何使用'
]
const BOTH_KEYWORDS = [
  '生成图片并解释', '生成图片并说明', '生成图片并描述',
  '生成图并解释', '生成图并说明', '生成图并描述',
  '画图并解释', '画图并说明', '画图并描述',
  '画个图并解释', '画个图并说明', '画个图并描述',
  '生成一张图并解释', '生成一张图并说明',
  '帮我画并解释', '帮我生成图片并解释',
  '生成图片并且说明', '生成图片而且解释',
  'generate image and explain', 'draw and explain',
  '生成图片然后解释', '生成图片再解释', '生成图片做解释',
  '并解释', '并说明', '并描述', '并且说明', '而且说明'
]

const _intentCache = new Map<string, 'text' | 'image' | 'both'>()
const INTENT_CACHE_MAX_SIZE = 1000

function quickClassifyIntent(message: string): 'text' | 'image' | 'both' {
  const msg = message.toLowerCase()

  if (BOTH_KEYWORDS.some(k => msg.includes(k))) {
    return 'both'
  }

  if (IMAGE_KEYWORDS.some(k => msg.includes(k))) {
    const hasTextOnly = TEXT_ONLY_KEYWORDS.some(k => msg.includes(k))
    if (!hasTextOnly) {
      return 'image'
    }
  }

  return 'text'
}

function extractImagePrompt(message: string): string {
  const cleanMsg = message
    .replace(/并解释|并说明|并描述|并且说明|而且说明|并且解释|而且解释/g, '')
    .replace(/生成图片|生成图|生成一幅|生成一张|画一张|画个|帮我画|帮我生成|做个|做张/g, '')
    .trim()
  if (cleanMsg) return cleanMsg

  const patterns = [
    /生成[图片图幅张个](.+)/,
    /画[个张幅](.+)/,
    /帮我画(.+)/,
    /帮我生成(.+)/
  ]
  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match?.[1]) {
      const cleaned = match[1].replace(/并解释|并说明|并描述/g, '').trim()
      if (cleaned) return cleaned
    }
  }
  return message
}

function getCachedIntent(message: string): 'text' | 'image' | 'both' | null {
  const key = message.toLowerCase().slice(0, 50)
  return _intentCache.get(key) || null
}

function setCachedIntent(message: string, intent: 'text' | 'image' | 'both'): void {
  if (_intentCache.size >= INTENT_CACHE_MAX_SIZE) {
    const firstKey = _intentCache.keys().next().value
    if (firstKey) _intentCache.delete(firstKey)
  }
  const key = message.toLowerCase().slice(0, 50)
  _intentCache.set(key, intent)
}

export async function runUnifiedGraph(
  userMessage: string,
  history: Array<{ role: string; content: string }> = []
): Promise<UnifiedResponse> {
  let intent = getCachedIntent(userMessage)

  if (!intent) {
    intent = quickClassifyIntent(userMessage)
    setCachedIntent(userMessage, intent)
  }

  try {
    switch (intent) {
      case 'text': {
        const result = await executeSkill('text', { userMessage, history })
        if (result.success && result.data) {
          return {
            intent: 'text',
            textReply: result.data.textReply || '',
            imageUrl: '',
            error: result.data.error || ''
          }
        }
        return {
          intent: 'text',
          textReply: '',
          imageUrl: '',
          error: result.error || '文本生成失败'
        }
      }

      case 'image': {
        const imagePrompt = extractImagePrompt(userMessage)
        const result = await executeSkill('image', { userMessage, imagePrompt })
        if (result.success && result.data) {
          return {
            intent: 'image',
            textReply: '',
            imageUrl: result.data.imageUrl || '',
            error: result.data.error || ''
          }
        }
        return {
          intent: 'image',
          textReply: '',
          imageUrl: '',
          error: result.error || '图片生成失败'
        }
      }

      case 'both': {
        const imagePrompt = extractImagePrompt(userMessage)

        const [textResult, imageResult] = await Promise.all([
          executeSkill('text', {
            userMessage,
            history,
            imagePrompt
          }),
          executeSkill('image', { userMessage, imagePrompt })
        ])

        const textReply = textResult.success ? (textResult.data?.textReply || '') : (textResult.error || '')
        const imageUrl = imageResult.success ? (imageResult.data?.imageUrl || '') : ''
        const error = !textResult.success ? `文字生成失败: ${textResult.error}` : (!imageResult.success ? `图片生成失败: ${imageResult.error}` : '')

        return {
          intent: 'both',
          textReply,
          imageUrl,
          error
        }
      }
    }
  } catch (err) {
    return {
      intent: 'text',
      textReply: '',
      imageUrl: '',
      error: (err as Error).message
    }
  }
}

let _graphCompileCount = 0

export function getUnifiedGraphRuntimeStats() {
  return {
    graphCompileCount: _graphCompileCount
  }
}

export function resetUnifiedGraphRuntimeStats(_options?: { resetSingletons?: boolean }) {
  _graphCompileCount = 0
}