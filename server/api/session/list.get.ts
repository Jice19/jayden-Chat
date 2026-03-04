import { PrismaClient } from '@prisma/client'

const prisma = (global as any).prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') (global as any).prisma = prisma

export default defineEventHandler(async (event) => {
  try {
    const userId = event.context.user?.sub
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })

    return {
      success: true,
      data: sessions
    }
  } catch (error) {
    console.error('获取会话列表失败:', error)
    return {
      success: false,
      message: (error as Error).message
    }
  }
})
