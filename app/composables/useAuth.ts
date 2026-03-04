import { ref, readonly } from 'vue'

export interface AuthUser {
  username: string
  userId: string
}

// 模块级单例，跨组件共享登录状态
const user = ref<AuthUser | null>(null)
const isLoggedIn = ref(false)
const showLoginModal = ref(false)

const TOKEN_KEY = 'auth_token'

const getToken = (): string => {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(TOKEN_KEY) || ''
}

const setToken = (token: string) => {
  localStorage.setItem(TOKEN_KEY, token)
  // 同步写 cookie，供 axios 拦截器读取
  document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`
}

const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY)
  document.cookie = 'token=; path=/; max-age=0'
}

export const useAuth = () => {
  const errorMsg = ref('')
  const loading = ref(false)

  const login = async (username: string, password: string): Promise<boolean> => {
    loading.value = true
    errorMsg.value = ''
    try {
      const res = await $fetch<{ code: number; success: boolean; data: { token: string; username: string } }>('/api/auth/login', {
        method: 'POST',
        body: { username, password }
      })
      if (res.success) {
        setToken(res.data.token)
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
      const res = await $fetch<{ code: number; success: boolean; data: { token: string; username: string } }>('/api/auth/register', {
        method: 'POST',
        body: { username, password }
      })
      if (res.success) {
        setToken(res.data.token)
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
    clearToken()
    user.value = null
    isLoggedIn.value = false
    showLoginModal.value = true
  }

  // 刷新页面时从 token 恢复会话（调用 /api/auth/me）
  const restoreSession = async () => {
    const token = getToken()
    if (!token) {
      showLoginModal.value = true
      return
    }
    try {
      const res = await $fetch<{ success: boolean; data: AuthUser }>('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.success) {
        // 确保 cookie 也同步（SSR hydration 后可能丢失）
        setToken(token)
        user.value = res.data
        isLoggedIn.value = true
      } else {
        clearToken()
        showLoginModal.value = true
      }
    } catch {
      clearToken()
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
