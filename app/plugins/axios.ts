import { defineNuxtPlugin, useRuntimeConfig, useCookie } from '#app'
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { createApiClient } from '~/utils/request'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const baseURL = (config.public as { apiBase?: string }).apiBase || '/api'
  const api = createApiClient({ baseURL })

  api.interceptors.request.use((request: InternalAxiosRequestConfig) => {
    const headers = request.headers
    const token = useCookie<string | null>('token').value
    if (token) {
      if (headers instanceof AxiosHeaders) {
        headers.set('Authorization', `Bearer ${token}`)
      } else {
        const headerObject = (headers ?? {}) as Record<string, string>
        request.headers = {
          ...headerObject,
          Authorization: `Bearer ${token}`
        } as typeof request.headers
      }
    }
    return request
  })

  // 响应拦截器：处理 401 并尝试刷新 Token
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config
      // 如果是 401 错误且不是刷新 Token 的请求本身
      if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/api/auth/refresh')) {
        originalRequest._retry = true
        const refreshToken = useCookie<string | null>('refresh_token').value
        
        if (refreshToken) {
          try {
            // 尝试请求刷新接口
            const { data } = await api.post('/auth/refresh', { refreshToken })
            if (data.success) {
              const { accessToken, refreshToken: newRefreshToken } = data.data
              
              // 更新 Cookie
              const tokenCookie = useCookie('token')
              const refreshCookie = useCookie('refresh_token')
              tokenCookie.value = accessToken
              refreshCookie.value = newRefreshToken
              
              // 更新 LocalStorage (如果是在浏览器环境)
              if (process.client) {
                localStorage.setItem('auth_access_token', accessToken)
                localStorage.setItem('auth_refresh_token', newRefreshToken)
              }

              // 重新发起原始请求
              originalRequest.headers.Authorization = `Bearer ${accessToken}`
              return api(originalRequest)
            }
          } catch (refreshError) {
            // 刷新失败，重定向到登录或清除状态
            if (process.client) {
              window.location.href = '/?login=1'
            }
          }
        }
      }
      return Promise.reject(error)
    }
  )

  return {
    provide: {
      api
    }
  }
})
