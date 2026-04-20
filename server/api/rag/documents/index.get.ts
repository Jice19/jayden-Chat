import { listRagDocuments } from '../../../util/rag-kb-store'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.sub as string | undefined
  if (!userId) {
    throw createError({ statusCode: 401, message: '未登录，请先登录' })
  }

  const docs = await listRagDocuments(userId)

  return {
    code: 200,
    success: true,
    message: '获取文档列表成功',
    data: docs
  }
})
