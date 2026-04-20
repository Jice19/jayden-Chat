import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { getUserKbDir } from '../../../util/rag-upload'

interface RagDocumentItem {
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

  const dir = getUserKbDir(userId)

  let fileNames: string[] = []
  try {
    fileNames = await readdir(dir)
  } catch {
    fileNames = []
  }

  const docs: RagDocumentItem[] = []
  for (const fileName of fileNames) {
    const fullPath = join(dir, fileName)
    const info = await stat(fullPath).catch(() => null)
    if (!info || !info.isFile()) {
      continue
    }

    const parts = fileName.split('-')
    const originalName = parts.length >= 3 ? parts.slice(2).join('-') : fileName
    const ext = fileName.includes('.') ? fileName.split('.').pop() || '' : ''
    docs.push({
      id: fileName,
      originalName,
      storedName: fileName,
      size: info.size,
      ext,
      uploadedAt: info.mtime.toISOString()
    })
  }

  docs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())

  return {
    code: 200,
    success: true,
    message: '获取文档列表成功',
    data: docs
  }
})
