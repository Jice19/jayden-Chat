import { ref } from 'vue'

const STORAGE_KEY = 'user_avatar_url'

// 模块级单例，跨组件共享
const userAvatar = ref<string>(
  typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) || '') : ''
)

export const useAvatar = () => {
  const isUploading = ref(false)
  const uploadError = ref('')

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

      const data = await res.json()
      if (data.success && data.data?.url) {
        userAvatar.value = data.data.url
        localStorage.setItem(STORAGE_KEY, data.data.url)
        return true
      } else {
        uploadError.value = data.message || '上传失败'
        return false
      }
    } catch (e) {
      uploadError.value = '上传异常，请重试'
      return false
    } finally {
      isUploading.value = false
    }
  }

  const clearAvatar = () => {
    userAvatar.value = ''
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    userAvatar,
    isUploading,
    uploadError,
    uploadAvatar,
    clearAvatar
  }
}
