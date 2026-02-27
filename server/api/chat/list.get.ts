// server/api/chat/list.get.ts
import { PrismaClient } from '@prisma/client'

// 全局单例模式
const prisma = globalThis.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

export default defineEventHandler(async () => {
  try {
    const chatList = await prisma.chat.findMany({
      orderBy: {
        createdAt: 'asc'
      }
    })

    // 兜底：如果查询结果为空，返回空数组
    const validChatList = chatList || []
    
    return {
      code: 200,
      success: true,
      message: '获取历史对话成功 ✅',
      data: validChatList
    }
  } catch (error) {
    const errorMsg = (error as Error).message
    // 兜底：即使报错，也返回空数组，避免前端读取 undefined
    return {
      code: 500,
      success: false,
      message: `查询失败 ❌：${errorMsg}`,
      data: [] // 关键：返回空数组，避免前端遍历 undefined
    }
  }
})