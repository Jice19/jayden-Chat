import { generateImage } from '../../util/aliyun-image'
import { PrismaClient } from '@prisma/client'
import type { ImageGenRequest } from '../../../types/image'

const prisma = (global as any).prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') (global as any).prisma = prisma

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as ImageGenRequest

  if (!body.prompt?.trim()) {
    return { success: false, message: '描述词不能为空' }
  }

  try {
    const result = await generateImage(body)

    // 写入数据库
    const record = await prisma.generatedImage.create({
      data: {
        prompt: result.prompt,
        url: result.url,
        size: result.size,
        negativePrompt: body.negativePrompt?.trim() || null
      }
    })

    return { success: true, result: { ...result, id: record.id } }
  } catch (error) {
    return { success: false, message: (error as Error).message }
  }
})
