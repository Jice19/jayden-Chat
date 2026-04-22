import { defineNuxtPlugin, useRuntimeConfig } from '#app'
import { createApiClient } from '~/utils/request'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const baseURL = (config.public as { apiBase?: string }).apiBase || '/api'
  const api = createApiClient({ baseURL })

  // 响应拦截器：处理 401 并尝试刷新 Token
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config
      if (!originalRequest) {
        return Promise.reject(error)
      }
      // 如果是 401 错误且不是刷新 Token 的请求本身
      if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/refresh')) {
        originalRequest._retry = true
        try {
          // 刷新接口从 HttpOnly Cookie 中读取 refresh_token，无需前端传参
          const refreshResponse = await api.post<{ success: boolean }>('/auth/refresh')
          if (refreshResponse.data?.success) {
            return api(originalRequest)
          }
        } catch {
          if (process.client) {
            window.location.href = '/?login=1'
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
