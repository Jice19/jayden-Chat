import { callAliyunAI } from '../util/aliyun-ai'

interface TextSkillState {
  userMessage: string
  history?: Array<{ role: string; content: string }>
  imageUrl?: string
}

export async function textGenerationSkill(
  state: TextSkillState
): Promise<{ textReply?: string; error?: string }> {
  try {
    let message = state.userMessage

    if (state.imageUrl) {
      message = `用户要求：${state.userMessage}\n\n注意：图片已单独生成（URL: ${state.imageUrl})，请只提供文字描述/解释，不要在回复中包含图片URL或markdown图片语法。`
    }

    const reply = await callAliyunAI(message, state.history || [])
    return { textReply: reply as string }
  } catch (err) {
    return { error: `文字生成失败: ${(err as Error).message}` }
  }
}