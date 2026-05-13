import { callAliyunAI } from '../util/aliyun-ai'

interface TextSkillState {
  userMessage: string
  history?: Array<{ role: string; content: string }>
  imagePrompt?: string
}

export async function textGenerationSkill(
  state: TextSkillState
): Promise<{ textReply?: string; error?: string }> {
  try {
    let message = state.userMessage

    if (state.imagePrompt) {
      message = `用户要求：${state.userMessage}\n\n已生成图片，图片描述关键词是："${state.imagePrompt}"。请根据这个描述提供简洁的文字说明/解释，不要在回复中包含图片URL。`
    }

    const reply = await callAliyunAI(message, state.history || [])
    return { textReply: reply as string }
  } catch (err) {
    return { error: `文字生成失败: ${(err as Error).message}` }
  }
}