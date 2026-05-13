import type { UnifiedState } from '../types/unified-state'
import { textGenerationSkill } from './text-generation'
import { imageGenerationSkill } from './image-generation'

export type SkillHandler = (state: UnifiedState) => Promise<Partial<UnifiedState>>

export interface Skill {
  name: string
  description: string
  handler: SkillHandler
}

export const skills: { text: Skill; image: Skill } = {
  text: {
    name: 'text',
    description: '文本生成技能：用于回答用户问题、解释概念、对话交流等纯文字交互场景',
    handler: textGenerationSkill
  },
  image: {
    name: 'image',
    description: '图片生成技能：用于根据文字描述生成图片，如画图、生成头像、生成插画等',
    handler: imageGenerationSkill
  }
}

export function getSkill(name: 'text' | 'image'): Skill | undefined {
  return skills[name]
}

export function getAllSkills(): Skill[] {
  return Object.values(skills)
}

export type { UnifiedState }
export { textGenerationSkill, imageGenerationSkill }