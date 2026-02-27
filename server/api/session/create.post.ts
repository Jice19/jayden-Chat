import { PrismaClient } from '@prisma/client'

const prisma = global.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event).catch(() => ({}))
    const { title } = body || {}

    const session = await prisma.session.create({
      data: {
        title: title || '新会话'
      }
    })

    return {
      success: true,
      data: session
    }
  } catch (error) {
    console.error('创建会话失败:', error)
    return {
      success: false,
      message: (error as Error).message
    }
  }
})
