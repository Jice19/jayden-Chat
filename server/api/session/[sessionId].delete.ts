import { PrismaClient } from '@prisma/client'

const prisma = (global as any).prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') (global as any).prisma = prisma

export default defineEventHandler(async (event) => {
  try {
    const sessionId = getRouterParam(event, 'sessionId')

    if (!sessionId) {
      return {
        code: 400,
        success: false,
        message: '会话 ID 不能为空！'
      }
    }

    const userId = event.context.user?.sub

    // 验证该会话属于当前用户
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId }
    })
    if (!session) {
      return { code: 404, success: false, message: '会话不存在或无权限' }
    }

    await prisma.chat.deleteMany({ where: { sessionId } })
    await prisma.session.delete({ where: { id: sessionId } })

    return {
      code: 200,
      success: true,
      message: '会话及相关聊天记录删除成功 ✅'
    }
  } catch (error) {
    const errorMsg = (error as Error).message
    console.error('删除会话失败:', error)
    return {
      code: 500,
      success: false,
      message: `删除失败 ❌：${errorMsg}`
    }
  }
})
