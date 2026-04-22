import { ref, readonly } from 'vue'

export interface AuthUser {
  username: string
  userId: string
}

// 模块级单例，跨组件共享登录状态
const user = ref<AuthUser | null>(null)
const isLoggedIn = ref(false)
const showLoginModal = ref(false)

const clearTokens = () => {
  if (!process.client) return
  document.cookie = 'token=; path=/; max-age=0'
  document.cookie = 'refresh_token=; path=/; max-age=0'
}

export const useAuth = () => {
  const errorMsg = ref('')
  const loading = ref(false)

  const login = async (username: string, password: string): Promise<boolean> => {
    loading.value = true
    errorMsg.value = ''
    try {
      const res = await $fetch<{ code: number; success: boolean; data: { username: string } }>('/api/auth/login', {
        method: 'POST',
        body: { username, password }
      })
      if (res.success) {
        user.value = { username: res.data.username, userId: '' }
        isLoggedIn.value = true
        showLoginModal.value = false
        return true
      }
      return false
    } catch (e: any) {
      errorMsg.value = e?.data?.message || e?.message || '登录失败'
      return false
    } finally {
      loading.value = false
    }
  }

  const register = async (username: string, password: string): Promise<boolean> => {
    loading.value = true
    errorMsg.value = ''
    try {
      const res = await $fetch<{ code: number; success: boolean; data: { username: string } }>('/api/auth/register', {
        method: 'POST',
        body: { username, password }
      })
      if (res.success) {
        user.value = { username: res.data.username, userId: '' }
        isLoggedIn.value = true
        showLoginModal.value = false
        return true
      }
      return false
    } catch (e: any) {
      errorMsg.value = e?.data?.message || e?.message || '注册失败'
      return false
    } finally {
      loading.value = false
    }
  }

  const logout = async () => {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // 忽略退出失败，仍然清理本地状态
    }
    clearTokens()
    user.value = null
    isLoggedIn.value = false
    showLoginModal.value = true
  }

  // 刷新页面时从 HttpOnly Cookie 恢复会话
  const restoreSession = async () => {
    try {
      const res = await $fetch<{ success: boolean; data: AuthUser }>('/api/auth/me')
      if (res.success) {
        user.value = res.data
        isLoggedIn.value = true
        showLoginModal.value = false
      } else {
        clearTokens()
        showLoginModal.value = true
      }
    } catch {
      // access token 过期时，尝试使用 refresh token 静默刷新
      try {
        const refreshRes = await $fetch<{ success: boolean }>('/api/auth/refresh', {
          method: 'POST'
        })
        if (refreshRes.success) {
          return restoreSession()
        }
      } catch {
        // 刷新失败，清理状态
      }
      clearTokens()
      user.value = null
      isLoggedIn.value = false
      showLoginModal.value = true
    }
  }

  return {
    user: readonly(user),
    isLoggedIn: readonly(isLoggedIn),
    showLoginModal,
    errorMsg,
    loading,
    login,
    register,
    logout,
    restoreSession
  }
}
