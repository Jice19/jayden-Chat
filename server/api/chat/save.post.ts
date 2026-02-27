// server/api/chat/save.post.ts
// 核心：用 Nuxt 内置的 import 方式，兼容 Prisma 5.x
import { PrismaClient } from '@prisma/client'

// 解决 Nuxt 热更新时重复创建 Prisma 实例的问题（可选但推荐）
const prisma = global.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export default defineEventHandler(async (event) => {
  try {
    const requestBody = await readBody(event)
    const { content, isUser } = requestBody

    if (!content || content.trim() === '') {
      return {
        code: 400,
        success: false,
        message: '对话内容不能为空！'
      }
    }

    const savedChat = await prisma.chat.create({
      data: {
        content: content.trim(),
        isUser: isUser || false
      }
    })

    return {
      code: 200,
      success: true,
      message: '对话保存成功 ✅',
      data: savedChat
    }
  } catch (error) {
    const errorMsg = (error as Error).message
    return {
      code: 500,
      success: false,
      message: `保存失败 ❌：${errorMsg}`,
      error: errorMsg
    }
  }
})