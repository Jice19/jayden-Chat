import { ref } from 'vue'
import type { ImageGenResult, ImageGenRequest } from '../../types/image'

export function useImageGen() {
  const isGenerating = ref(false)
  const isLoadingHistory = ref(false)
  const error = ref<string | null>(null)
  const history = ref<ImageGenResult[]>([])
  const total = ref(0)

  const loadHistory = async (page = 1) => {
    isLoadingHistory.value = true
    try {
      const res = await $fetch<{
        success: boolean
        items: ImageGenResult[]
        total: number
      }>('/api/image/list', { query: { page, pageSize: 20 } })

      if (res.success) {
        history.value = page === 1 ? res.items : [...history.value, ...res.items]
        total.value = res.total
      }
    } finally {
      isLoadingHistory.value = false
    }
  }

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
      total.value++
      return res.result
    } catch (e) {
      error.value = (e as Error).message
      return null
    } finally {
      isGenerating.value = false
    }
  }

  return { isGenerating, isLoadingHistory, error, history, total, loadHistory, generate }
}
