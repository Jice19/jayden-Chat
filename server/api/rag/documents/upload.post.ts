import { writeFile } from 'node:fs/promises'
import {
  MAX_UPLOAD_SIZE,
  RAG_ALLOWED_EXTENSIONS,
  buildStoredFileName,
  buildStoredFilePath,
  ensureUserKbDir,
  isAllowedFileType
} from '../../../util/rag-upload'

interface UploadResponse {
  id: string
  originalName: string
  storedName: string
  size: number
  ext: string
  uploadedAt: string
}

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.sub as string | undefined
  if (!userId) {
    throw createError({ statusCode: 401, message: '未登录，请先登录' })
  }

  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, message: '请上传文件' })
  }

  const filePart = formData.find((part) => part.name === 'file' && Boolean(part.filename))
  if (!filePart || !filePart.filename || !filePart.data) {
    throw createError({ statusCode: 400, message: '缺少文件字段 file' })
  }

  if (!isAllowedFileType(filePart.filename)) {
    throw createError({
      statusCode: 400,
      message: `暂仅支持 ${RAG_ALLOWED_EXTENSIONS.join(', ')} 格式`
    })
  }

  if (filePart.data.byteLength > MAX_UPLOAD_SIZE) {
    throw createError({
      statusCode: 400,
      message: `文件过大，单文件最大 ${Math.floor(MAX_UPLOAD_SIZE / 1024 / 1024)}MB`
    })
  }

  await ensureUserKbDir(userId)
  const storedName = buildStoredFileName(filePart.filename)
  const filePath = buildStoredFilePath(userId, storedName)
  await writeFile(filePath, filePart.data)

  const payload: UploadResponse = {
    id: storedName,
    originalName: filePart.filename,
    storedName,
    size: filePart.data.byteLength,
    ext: storedName.split('.').pop() || '',
    uploadedAt: new Date().toISOString()
  }

  return {
    code: 200,
    success: true,
    message: '上传成功',
    data: payload
  }
})
