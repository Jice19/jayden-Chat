import { generateImage } from '../../util/aliyun-image'
import type { ImageGenRequest } from '../../../types/image'

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as ImageGenRequest

  if (!body.prompt?.trim()) {
    return { success: false, message: '描述词不能为空' }
  }

  try {
    const result = await generateImage(body)
    return { success: true, result }
  } catch (error) {
    return { success: false, message: (error as Error).message }
  }
})
