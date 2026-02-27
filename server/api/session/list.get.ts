import { PrismaClient } from '@prisma/client'

const prisma = global.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export default defineEventHandler(async (event) => {
  try {
    const sessions = await prisma.session.findMany({
      orderBy: {
        createdAt: 'desc'
      }
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
