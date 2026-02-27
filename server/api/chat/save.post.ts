// 核心：用 Nuxt 内置的 import 方式，兼容 Prisma 5.x
import { PrismaClient } from '@prisma/client'

// 解决 Nuxt 热更新时重复创建 Prisma 实例的问题（可选但推荐）
const prisma = global.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') global.prisma = prisma
// 打印全局变量，验证是否读取成功
  // console.log('全局 API Key：', process.env.ALIYUN_API_KEY) 

export default defineEventHandler(async (event) => {
  try {
    const requestBody = await readBody(event)
    const { content, isUser, sessionId } = requestBody

    if (!content || content.trim() === '') {
      return {
        code: 400,
        success: false,
        message: '对话内容不能为空！'
      }
    }

    let currentSessionId = sessionId

    // 如果没有 SessionID，且是用户消息，则创建新会话
    // 注意：如果是 AI 回复，前端必须传 SessionID，否则 AI 回复会变成无主或者新会话（逻辑上不通）
    // 不过，为了健壮性，如果 AI 回复没带 ID，我们也可以暂时允许为空或者新建（虽然不合理）
    // 这里我们主要处理用户第一条消息自动建会话的逻辑
    if (!currentSessionId && isUser) {
      const title = content.trim().substring(0, 20)
      const newSession = await prisma.session.create({
        data: {
          title
        }
      })
      currentSessionId = newSession.id
    }

    const savedChat = await prisma.chat.create({
      data: {
        content: content.trim(),
        isUser: isUser || false,
        sessionId: currentSessionId
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