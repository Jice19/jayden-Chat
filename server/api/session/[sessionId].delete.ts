import { PrismaClient } from '@prisma/client'

const prisma = global.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') global.prisma = prisma

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

    // 删除与该会话关联的所有聊天记录
    await prisma.chat.deleteMany({
      where: {
        sessionId: sessionId
      }
    })

    // 删除会话本身
    await prisma.session.delete({
      where: {
        id: sessionId
      }
    })

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
