/**
 * POST /api/chat/unified
 *
 * 统一智能回复端点：自动判断意图，返回文字 / 图片 / 两者
 *
 * 请求体：
 *   { message: string, sessionId?: string }
 *
 * 响应：
 *   {
 *     intent: 'text' | 'image' | 'both',
 *     textReply: string,      // 文字回复（intent=text 或 both 时有值）
 *     imageUrl: string,       // 图片 URL（intent=image 或 both 时有值）
 *     error: string           // 空字符串表示成功
 *   }
 */
import { runUnifiedGraph } from '../../util/unified-graph'
import { PrismaClient } from '@prisma/client'
import { verifyToken } from '../../util/jwt'

const prisma = (global as any).__prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') (global as any).__prisma = prisma

export default defineEventHandler(async (event) => {
  // 1. 读取请求体
  const body = await readBody(event)
  const { message, sessionId } = body as { message: string; sessionId?: string }

  if (!message?.trim()) {
    throw createError({ statusCode: 400, message: '消息不能为空' })
  }

  // 2. 可选：验证登录（登录了才能保存历史），未登录也可以用
  let userId: string | null = null
  let history: Array<{ role: string; content: string }> = []

  try {
    const token = getCookie(event, 'token') || getHeader(event, 'authorization')?.replace('Bearer ', '')
    if (token) {
      const payload = await verifyToken(token)
      userId = payload.sub as string
    }
  } catch {
    // 未登录时不影响使用，history 为空
  }

  // 3. 如果有 sessionId，拉取最近 20 条历史作为上下文
  if (sessionId && userId) {
    const chats = await prisma.chat.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
    // 反转成正序，转成 LangChain 需要的格式
    history = chats.reverse().map((c: { isUser: boolean; content: string }) => ({
      role: c.isUser ? 'user' : 'assistant',
      content: c.content
    }))
  }

  // 4. 调用 LangGraph 统一图
  const result = await runUnifiedGraph(message, history)

  // 5. 如果登录了且有 sessionId，保存记录到数据库
  if (userId && sessionId && !result.error) {
    // 保存用户消息
    await prisma.chat.create({
      data: {
        content: message,
        isUser: true,
        sessionId
      }
    })

    // 根据意图保存 AI 回复
    if (result.textReply) {
      await prisma.chat.create({
        data: {
          content: result.textReply,
          isUser: false,
          sessionId
        }
      })
    }

    // 图片记录保存到 GeneratedImage 表
    if (result.imageUrl) {
      await prisma.generatedImage.create({
        data: {
          prompt: message,
          url: result.imageUrl,
          size: '1024*1024'
        }
      })
    }
  }

  return result
})
