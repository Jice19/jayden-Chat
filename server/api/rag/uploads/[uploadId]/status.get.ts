import { getUploadSession } from '../../../../util/rag-kb-store'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.sub as string | undefined
  if (!userId) {
    throw createError({ statusCode: 401, message: '未登录，请先登录' })
  }

  const uploadId = getRouterParam(event, 'uploadId')
  if (!uploadId) {
    throw createError({ statusCode: 400, message: 'uploadId 不能为空' })
  }

  const session = await getUploadSession(userId, uploadId)
  if (!session) {
    throw createError({ statusCode: 404, message: '上传会话不存在' })
  }

  return {
    code: 200,
    success: true,
    message: '获取上传状态成功',
    data: {
      uploadId: session.id,
      status: session.status,
      uploadedChunkIndexes: session.uploadedChunkIndexes,
      totalChunks: session.totalChunks,
      progress: Number(((session.uploadedChunkIndexes.length / session.totalChunks) * 100).toFixed(2)),
      errorMessage: session.errorMessage || ''
    }
  }
})
