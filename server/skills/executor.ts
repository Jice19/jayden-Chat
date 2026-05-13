import type { SkillName } from './types'
import { textGenerationSkill } from './text-generation'
import { imageGenerationSkill } from './image-generation'

export type { SkillName }

export interface SkillResult {
  success: boolean
  data?: {
    textReply?: string
    imageUrl?: string
    error?: string
  }
  error?: string
}

export interface ExecutionResult {
  textReply?: string
  imageUrl?: string
  error?: string
}

export async function executeSkill(
  skillName: 'text' | 'image',
  state: { userMessage: string; history?: Array<{ role: string; content: string }>; imagePrompt?: string; imageUrl?: string }
): Promise<SkillResult> {
  try {
    let handler: typeof textGenerationSkill | typeof imageGenerationSkill

    switch (skillName) {
      case 'text':
        handler = textGenerationSkill
        break
      case 'image':
        handler = imageGenerationSkill
        break
      default:
        return { success: false, error: `Unknown skill: ${skillName}` }
    }

    const result = await handler(state as Parameters<typeof handler>[0])
    return { success: true, data: result }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export async function executeSkills(
  skillNames: SkillName[],
  state: { userMessage: string; history?: Array<{ role: string; content: string }>; imagePrompt?: string }
): Promise<ExecutionResult> {
  const results: ExecutionResult = {}

  for (const skillName of skillNames) {
    const result = await executeSkill(skillName, state)
    if (result.success && result.data) {
      if (result.data.textReply) {
        results.textReply = result.data.textReply
      }
      if (result.data.imageUrl) {
        results.imageUrl = result.data.imageUrl
      }
      if (result.data.error) {
        results.error = result.data.error
      }
    } else if (result.error) {
      results.error = result.error
    }
  }

  return results
}