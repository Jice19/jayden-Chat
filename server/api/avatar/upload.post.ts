import { readMultipartFormData } from 'h3'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export default defineEventHandler(async (event) => {
  try {
    const parts = await readMultipartFormData(event)
    if (!parts || parts.length === 0) {
      return { code: 400, success: false, message: '未收到文件' }
    }

    const file = parts.find(p => p.name === 'avatar')
    if (!file || !file.data) {
      return { code: 400, success: false, message: '字段名应为 avatar' }
    }

    const mimeType = file.type || ''
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return { code: 400, success: false, message: '仅支持 jpg/png/webp/gif 格式' }
    }

    if (file.data.length > MAX_SIZE) {
      return { code: 400, success: false, message: '文件不能超过 2MB' }
    }

    // 保存到 public/avatars/
    const uploadDir = join(process.cwd(), 'public', 'avatars')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    const ext = mimeType.split('/')[1].replace('jpeg', 'jpg')
    const filename = `user_${Date.now()}.${ext}`
    const filePath = join(uploadDir, filename)
    await writeFile(filePath, file.data)

    return {
      code: 200,
      success: true,
      message: '上传成功',
      data: { url: `/avatars/${filename}` }
    }
  } catch (error) {
    return {
      code: 500,
      success: false,
      message: `上传失败：${(error as Error).message}`
    }
  }
})
