import type { UnifiedState } from '../types/unified-state'
import { generateImage } from '../util/aliyun-image'

export async function imageGenerationSkill(
  state: UnifiedState
): Promise<Partial<UnifiedState>> {
  const promptFromState =
    typeof state.imagePrompt === 'string' ? state.imagePrompt.trim() : ''
  const prompt = promptFromState || state.userMessage.trim()

  try {
    const result = await generateImage({ prompt })
    return { imageUrl: result.url }
  } catch (err) {
    return { error: `图片生成失败: ${(err as Error).message}` }
  }
}