export type SkillName = 'text' | 'image'

export type SkillHandler = (state: {
  userMessage: string
  history?: Array<{ role: string; content: string }>
  imagePrompt?: string
}) => Promise<{
  textReply?: string
  imageUrl?: string
  error?: string
}>

export interface Skill {
  name: SkillName
  description: string
  handler: SkillHandler
}