import { generateImage } from '../util/aliyun-image'

interface ImageSkillState {
  userMessage: string
  imagePrompt?: string
}

export async function imageGenerationSkill(
  state: ImageSkillState
): Promise<{ imageUrl?: string; error?: string }> {
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