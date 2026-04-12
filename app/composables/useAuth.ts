import { ref, readonly } from 'vue'

export interface AuthUser {
  username: string
  userId: string
}

// 模块级单例，跨组件共享登录状态
const user = ref<AuthUser | null>(null)
const isLoggedIn = ref(false)
const showLoginModal = ref(false)

const ACCESS_TOKEN_KEY = 'auth_access_token'
const REFRESH_TOKEN_KEY = 'auth_refresh_token'

const getAccessToken = (): string => {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(ACCESS_TOKEN_KEY) || ''
}

const getRefreshToken = (): string => {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(REFRESH_TOKEN_KEY) || ''
}

const setTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  // 同步写 cookie，供 axios 拦截器读取
  document.cookie = `token=${accessToken}; path=/; max-age=${2 * 3600}; SameSite=Lax`
  document.cookie = `refresh_token=${refreshToken}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`
}

const clearTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
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
      const res = await $fetch<{ code: number; success: boolean; data: { accessToken: string; refreshToken: string; username: string } }>('/api/auth/login', {
        method: 'POST',
        body: { username, password }
      })
      if (res.success) {
        setTokens(res.data.accessToken, res.data.refreshToken)
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
      const res = await $fetch<{ code: number; success: boolean; data: { accessToken: string; refreshToken: string; username: string } }>('/api/auth/register', {
        method: 'POST',
        body: { username, password }
      })
      if (res.success) {
        setTokens(res.data.accessToken, res.data.refreshToken)
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

  const logout = () => {
    clearTokens()
    user.value = null
    isLoggedIn.value = false
    showLoginModal.value = true
  }

  // 刷新页面时从 token 恢复会话（调用 /api/auth/me）
  const restoreSession = async () => {
    const token = getAccessToken()
    if (!token) {
      showLoginModal.value = true
      return
    }
    try {
      const res = await $fetch<{ success: boolean; data: AuthUser }>('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.success) {
        // 恢复会话时不需要重新 setTokens，除非 token 发生了变化
        user.value = res.data
        isLoggedIn.value = true
      } else {
        clearTokens()
        showLoginModal.value = true
      }
    } catch {
      // 如果 access token 过期，尝试静默刷新
      const refreshToken = getRefreshToken()
      if (refreshToken) {
        try {
          const refreshRes = await $fetch<{ success: boolean; data: { accessToken: string; refreshToken: string } }>('/api/auth/refresh', {
            method: 'POST',
            body: { refreshToken }
          })
          if (refreshRes.success) {
            setTokens(refreshRes.data.accessToken, refreshRes.data.refreshToken)
            return restoreSession()
          }
        } catch {
          // 刷新失败，清除 token
        }
      }
      clearTokens()
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
