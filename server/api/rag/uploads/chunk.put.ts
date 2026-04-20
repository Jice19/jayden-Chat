import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { getChunkPath, getChunksDir, getUploadSession, markChunkUploaded } from '../../../util/rag-kb-store'

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.sub as string | undefined
  if (!userId) {
    throw createError({ statusCode: 401, message: '未登录，请先登录' })
  }

  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, message: '请上传分片数据' })
  }

  const getText = (name: string): string =>
    String(parts.find((part) => part.name === name)?.data?.toString('utf-8') || '').trim()

  const uploadId = getText('uploadId')
  const chunkIndex = Number(getText('chunkIndex'))
  const chunkHash = getText('chunkHash').toLowerCase()
  const filePart = parts.find((part) => part.name === 'chunkFile' && Boolean(part.filename))

  if (!uploadId || Number.isNaN(chunkIndex) || chunkIndex < 0 || !filePart?.data) {
    throw createError({ statusCode: 400, message: '分片参数无效' })
  }

  const session = await getUploadSession(userId, uploadId)
  if (!session) {
    throw createError({ statusCode: 404, message: '上传会话不存在' })
  }
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    throw createError({ statusCode: 410, message: '上传会话已过期，请重新初始化' })
  }
  if (chunkIndex >= session.totalChunks) {
    throw createError({ statusCode: 400, message: 'chunkIndex 越界' })
  }

  if (chunkHash) {
    const serverChunkHash = createHash('sha256').update(filePart.data).digest('hex')
    if (serverChunkHash !== chunkHash) {
      throw createError({ statusCode: 400, message: '分片校验失败，请重试' })
    }
  }

  const chunksDir = getChunksDir(userId, uploadId)
  await mkdir(chunksDir, { recursive: true })
  await writeFile(getChunkPath(userId, uploadId, chunkIndex), filePart.data)
  const latest = await markChunkUploaded(userId, uploadId, chunkIndex)

  return {
    code: 200,
    success: true,
    message: '分片上传成功',
    data: {
      chunkIndex,
      uploadedCount: latest.uploadedChunkIndexes.length,
      totalChunks: latest.totalChunks
    }
  }
})
