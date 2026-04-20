import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { buildStoredFileName, normalizeExt } from '../../../util/rag-upload'
import {
  cleanupUploadChunks,
  finalizeUpload,
  getUploadSession,
  mergeChunksToTempFile,
  saveUploadSession
} from '../../../util/rag-kb-store'
import { ingestDocumentToRag } from '../../../util/rag-index'

interface CompleteBody {
  uploadId: string
  fileHash: string
}

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.sub as string | undefined
  if (!userId) {
    throw createError({ statusCode: 401, message: '未登录，请先登录' })
  }

  const body = await readBody<CompleteBody>(event)
  const uploadId = String(body.uploadId || '').trim()
  const fileHash = String(body.fileHash || '').trim().toLowerCase()

  if (!uploadId || !fileHash) {
    throw createError({ statusCode: 400, message: '缺少 uploadId/fileHash' })
  }

  const session = await getUploadSession(userId, uploadId)
  if (!session) {
    throw createError({ statusCode: 404, message: '上传会话不存在' })
  }
  if (session.uploadedChunkIndexes.length !== session.totalChunks) {
    throw createError({ statusCode: 400, message: '分片未上传完成，请继续上传' })
  }

  try {
    session.status = 'MERGING'
    await saveUploadSession(session)

    const tempPath = await mergeChunksToTempFile(session)
    const mergedBuffer = await readFile(tempPath)
    const mergedHash = createHash('sha256').update(mergedBuffer).digest('hex')
    if (mergedHash !== fileHash) {
      session.status = 'FAILED'
      session.errorMessage = '文件合并后 hash 校验失败'
      await saveUploadSession(session)
      throw createError({ statusCode: 400, message: '文件校验失败，请重新上传' })
    }

    const ext = normalizeExt(session.fileName).replace('.', '') || extname(session.fileName).replace('.', '')
    const storedName = buildStoredFileName(session.fileName)
    const document = await finalizeUpload(session, storedName, ext)
    await cleanupUploadChunks(userId, uploadId)
    ingestDocumentToRag(userId, document).catch((ingestError) => {
      console.error('RAG 文档入库失败:', ingestError)
    })

    return {
      code: 200,
      success: true,
      message: '文件上传完成',
      data: {
        document
      }
    }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) {
      throw error
    }
    session.status = 'FAILED'
    session.errorMessage = (error as Error).message
    await saveUploadSession(session)
    throw createError({ statusCode: 500, message: `文件合并失败：${(error as Error).message}` })
  }
})
