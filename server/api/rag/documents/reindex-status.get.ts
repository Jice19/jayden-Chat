import { getRagReindexStatus } from '../../../util/rag-reindex-job'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.sub as string | undefined
  if (!userId) {
    throw createError({ statusCode: 401, message: '未登录，请先登录' })
  }

  const status = getRagReindexStatus(userId)
  return {
    code: 200,
    success: true,
    message: status ? '获取重建状态成功' : '暂无重建任务',
    data:
      status || {
        running: false,
        total: 0,
        success: 0,
        failed: 0,
        startedAt: '',
        message: '暂无重建任务'
      }
  }
})
