import { ref } from 'vue'
import type { ImageGenResult, ImageGenRequest } from '../../types/image'

export function useImageGen() {
  const isGenerating = ref(false)
  const error = ref<string | null>(null)
  const history = ref<ImageGenResult[]>([])

  const generate = async (req: ImageGenRequest) => {
    isGenerating.value = true
    error.value = null

    try {
      const res = await $fetch<{ success: boolean; result?: ImageGenResult; message?: string }>(
        '/api/image/generate',
        { method: 'POST', body: req }
      )

      if (!res.success || !res.result) {
        error.value = res.message ?? '生成失败'
        return null
      }

      history.value.unshift(res.result)
      return res.result
    } catch (e) {
      error.value = (e as Error).message
      return null
    } finally {
      isGenerating.value = false
    }
  }

  return { isGenerating, error, history, generate }
}
