import { ref, watch } from 'vue'
import { useAuth } from './useAuth'

interface AvatarResponse {
  success: boolean
  message?: string
  data?: {
    url?: string
  }
}

// 模块级单例，跨组件共享
const userAvatar = ref<string>('')
let hasLoadedAvatar = false
let loadAvatarPromise: Promise<void> | null = null
let hasBoundAuthWatcher = false

export const useAvatar = () => {
  const isUploading = ref(false)
  const uploadError = ref('')

  const clearAvatar = () => {
    userAvatar.value = ''
    hasLoadedAvatar = false
  }

  const loadAvatar = async (force = false): Promise<void> => {
    if (!import.meta.client) return
    if (!force && hasLoadedAvatar) return
    if (!force && loadAvatarPromise) return loadAvatarPromise

    loadAvatarPromise = (async () => {
      try {
        const res = await $fetch<AvatarResponse>('/api/avatar/me')
        if (res.success) {
          userAvatar.value = res.data?.url || ''
          hasLoadedAvatar = true
          return
        }
        clearAvatar()
      } catch {
        clearAvatar()
      } finally {
        loadAvatarPromise = null
      }
    })()

    return loadAvatarPromise
  }

  const uploadAvatar = async (file: File): Promise<boolean> => {
    isUploading.value = true
    uploadError.value = ''

    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const res = await fetch('/api/avatar/upload', {
        method: 'POST',
        body: formData
      })
      const data = (await res.json()) as AvatarResponse

      if (data.success && data.data?.url) {
        userAvatar.value = data.data.url
        hasLoadedAvatar = true
        return true
      }

      uploadError.value = data.message || '上传失败'
      return false
    } catch {
      uploadError.value = '上传异常，请重试'
      return false
    } finally {
      isUploading.value = false
    }
  }

  if (import.meta.client) {
    if (!hasBoundAuthWatcher) {
      const { isLoggedIn } = useAuth()
      watch(
        isLoggedIn,
        (loggedIn) => {
          if (loggedIn) {
            void loadAvatar(true)
            return
          }
          clearAvatar()
        },
        { immediate: true }
      )
      hasBoundAuthWatcher = true
    }
    void loadAvatar()
  }

  return {
    userAvatar,
    isUploading,
    uploadError,
    loadAvatar,
    uploadAvatar,
    clearAvatar
  }
}
