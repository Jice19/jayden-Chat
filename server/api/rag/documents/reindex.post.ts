import { ingestDocumentToRag } from '../../../util/rag-index'
import { listRagDocuments } from '../../../util/rag-kb-store'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.sub as string | undefined
  if (!userId) {
    throw createError({ statusCode: 401, message: '未登录，请先登录' })
  }

  const docs = await listRagDocuments(userId)
  if (docs.length === 0) {
    return {
      code: 200,
      success: true,
      message: '暂无可重建文档',
      data: { total: 0, success: 0, failed: 0 }
    }
  }

  let success = 0
  let failed = 0
  for (const doc of docs) {
    try {
      await ingestDocumentToRag(userId, doc)
      success += 1
    } catch {
      failed += 1
    }
  }

  return {
    code: 200,
    success: true,
    message: '重建完成',
    data: {
      total: docs.length,
      success,
      failed
    }
  }
})
