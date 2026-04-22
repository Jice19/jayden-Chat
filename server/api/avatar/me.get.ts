import { PrismaClient } from '@prisma/client'

const prisma = (global as any).prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') (global as any).prisma = prisma

const isAvatarSchemaNotReady = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Unknown field `avatarUrl`') || message.includes('Unknown argument `avatarUrl`') || message.includes('column') && message.includes('avatarUrl')
}

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.sub as string | undefined
  if (!userId) {
    return {
      code: 401,
      success: false,
      message: '未登录，请先登录',
      data: { url: '' }
    }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true }
    })

    return {
      code: 200,
      success: true,
      message: '获取头像成功',
      data: { url: user?.avatarUrl ?? '' }
    }
  } catch (error) {
    if (isAvatarSchemaNotReady(error)) {
      return {
        code: 200,
        success: true,
        message: '头像字段尚未同步到数据库，返回空头像',
        data: { url: '' }
      }
    }
    throw error
  }
})
