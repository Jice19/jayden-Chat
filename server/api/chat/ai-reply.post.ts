import { callAliyunAI } from '../../util/aliyun-ai'
import { PrismaClient } from '@prisma/client'

const prisma = global.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export default defineEventHandler(async (event) => {
  try {
    // 1. 获取前端传递的用户提问
    const body = await readBody(event)
    const { prompt, sessionId } = body

    if (!prompt || prompt.trim() === '') {
      return {
        code: 400,
        success: false,
        message: '提问内容不能为空！',
        reply: ''
      }
    }

    // 2. 获取上下文历史
    let history: Array<{ role: string, content: string }> = []
    if (sessionId) {
      const chats = await prisma.chat.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        take: 20 // 获取最近20条作为上下文
      })
      
      // 按时间正序排列
      history = chats.reverse().map((c: any) => ({
        role: c.isUser ? 'user' : 'assistant',
        content: c.content
      }))

      // 如果最后一条是本次提问（数据库已存），则从 history 中移除，避免重复
      const lastMsg = history[history.length - 1]
      if (lastMsg && lastMsg.role === 'user' && lastMsg.content === prompt.trim()) {
        history.pop()
      }
    }

    // 3. 调用阿里云 AI 接口（带上下文）
    const reply = await callAliyunAI(prompt, history)

    // 4. 返回 AI 回复给前端
    return {
      code: 200,
      success: true,
      message: 'AI 回复生成成功',
      reply: reply // 真实的 AI 回复内容
    }
  } catch (error) {
    const errorMsg = (error as Error).message
    return {
      code: 500,
      success: false,
      message: errorMsg,
      reply: '❌ 抱歉，AI 回复生成失败，请稍后重试'
    }
  }
})