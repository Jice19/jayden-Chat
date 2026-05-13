import type { Skill, SkillHandler } from './types'
import { textGenerationSkill } from './text-generation'
import { imageGenerationSkill } from './image-generation'

export const skills: Record<string, Skill> = {
  text: {
    name: 'text',
    description: '文本生成技能：用于回答用户问题、解释概念、对话交流等纯文字交互场景',
    handler: textGenerationSkill as SkillHandler
  },
  image: {
    name: 'image',
    description: '图片生成技能：用于根据文字描述生成图片，如画图、生成头像、生成插画等',
    handler: imageGenerationSkill as SkillHandler
  }
}

export function getSkill(name: string): Skill | undefined {
  return skills[name]
}

export function getAllSkills(): Skill[] {
  return Object.values(skills)
}

export type { Skill, SkillHandler }