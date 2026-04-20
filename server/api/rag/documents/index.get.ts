import { listRagDocuments } from '../../../util/rag-kb-store'
import { getIndexedDocumentIds } from '../../../util/rag-index'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.sub as string | undefined
  if (!userId) {
    throw createError({ statusCode: 401, message: '未登录，请先登录' })
  }

  const docs = await listRagDocuments(userId)
  const indexedDocumentIds = await getIndexedDocumentIds(userId)
  const normalizedDocs = docs.map((doc) => ({
    ...doc,
    indexStatus: indexedDocumentIds.has(doc.id) ? 'READY' : 'PENDING'
  }))

  return {
    code: 200,
    success: true,
    message: '获取文档列表成功',
    data: normalizedDocs
  }
})
