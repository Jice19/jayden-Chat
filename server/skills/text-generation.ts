import type { UnifiedState } from '../types/unified-state'
import { callAliyunAI } from '../util/aliyun-ai'

export async function textGenerationSkill(
  state: UnifiedState
): Promise<Partial<UnifiedState>> {
  try {
    const reply = await callAliyunAI(state.userMessage, state.history)
    return { textReply: reply as string }
  } catch (err) {
    return { error: `文字生成失败: ${(err as Error).message}` }
  }
}