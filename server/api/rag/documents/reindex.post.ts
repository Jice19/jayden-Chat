import { getRagReindexStatus, startRagReindexJob } from '../../../util/rag-reindex-job'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.sub as string | undefined
  if (!userId) {
    throw createError({ statusCode: 401, message: '未登录，请先登录' })
  }

  const existing = getRagReindexStatus(userId)
  if (existing?.running) {
    return {
      code: 200,
      success: true,
      message: '重建任务进行中',
      data: existing
    }
  }
  const status = await startRagReindexJob(userId)

  return {
    code: 200,
    success: true,
    message: '重建任务已启动',
    data: status
  }
})
