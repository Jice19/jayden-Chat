import { callAliyunAI } from '../../util/aliyun-ai'

export default defineEventHandler(async (event) => {
  try {
    // 1. 获取前端传递的用户提问
    const body = await readBody(event)
    if (!body.prompt || body.prompt.trim() === '') {
      return {
        code: 400,
        success: false,
        message: '提问内容不能为空！',
        reply: ''
      }
    }

    // 2. 调用阿里云 AI 接口（核心：使用全局 API Key）
    const reply = await callAliyunAI(body.prompt)

    // 3. 返回 AI 回复给前端
    return {
      code: 200,
      success: true,
      message: 'AI 回复生成成功',
      reply: reply // 真实的 AI 回复内容
    }
  } catch (error) {
    const errorMsg = (error as Error).message
    return {
      code: 500,
      success: false,
      message: errorMsg,
      reply: '❌ 抱歉，AI 回复生成失败，请稍后重试'
    }
  }
})