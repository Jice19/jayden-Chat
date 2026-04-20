import { createHash } from 'node:crypto'
import {
  RAG_ALLOWED_EXTENSIONS,
  buildStoredFileName,
  normalizeExt
} from '../../../util/rag-upload'
import {
  createUploadSession,
  findActiveSessionByHash,
  findRagDocumentByHash
} from '../../../util/rag-kb-store'

const MAX_CHUNKED_UPLOAD_SIZE = 500 * 1024 * 1024
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024

interface InitBody {
  fileName: string
  fileHash: string
  fileSize: number
  chunkSize?: number
}

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.sub as string | undefined
  if (!userId) {
    throw createError({ statusCode: 401, message: '未登录，请先登录' })
  }

  const body = await readBody<InitBody>(event)
  const fileName = String(body.fileName || '').trim()
  const fileHash = String(body.fileHash || '').trim().toLowerCase()
  const fileSize = Number(body.fileSize || 0)
  const chunkSize = Number(body.chunkSize || DEFAULT_CHUNK_SIZE)

  if (!fileName || !fileHash || !fileSize) {
    throw createError({ statusCode: 400, message: '缺少必要参数 fileName/fileHash/fileSize' })
  }
  if (!RAG_ALLOWED_EXTENSIONS.includes(normalizeExt(fileName))) {
    throw createError({
      statusCode: 400,
      message: `暂仅支持 ${RAG_ALLOWED_EXTENSIONS.join(', ')} 格式`
    })
  }
  if (fileSize > MAX_CHUNKED_UPLOAD_SIZE) {
    throw createError({
      statusCode: 400,
      message: `文件过大，最大支持 ${Math.floor(MAX_CHUNKED_UPLOAD_SIZE / 1024 / 1024)}MB`
    })
  }
  if (chunkSize <= 0) {
    throw createError({ statusCode: 400, message: 'chunkSize 非法' })
  }

  const already = await findRagDocumentByHash(userId, fileHash, fileSize)
  if (already) {
    return {
      code: 200,
      success: true,
      message: '秒传成功',
      data: {
        shouldUpload: false,
        uploadId: '',
        uploadedChunkIndexes: [],
        document: already
      }
    }
  }

  const active = await findActiveSessionByHash(userId, fileHash, fileSize)
  if (active) {
    return {
      code: 200,
      success: true,
      message: '已恢复上传会话',
      data: {
        shouldUpload: true,
        uploadId: active.id,
        uploadedChunkIndexes: active.uploadedChunkIndexes,
        totalChunks: active.totalChunks
      }
    }
  }

  const totalChunks = Math.ceil(fileSize / chunkSize)
  const session = await createUploadSession({
    userId,
    fileName,
    fileHash,
    fileSize,
    chunkSize,
    totalChunks
  })

  // 生成一次性校验签名占位，后续可用于防重放（当前先返回调试字段）
  const initDigest = createHash('sha1').update(`${session.id}:${fileHash}`).digest('hex')

  return {
    code: 200,
    success: true,
    message: '上传会话创建成功',
    data: {
      shouldUpload: true,
      uploadId: session.id,
      uploadedChunkIndexes: [],
      totalChunks,
      initDigest,
      suggestStoredName: buildStoredFileName(fileName)
    }
  }
})
