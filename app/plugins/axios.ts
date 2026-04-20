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
        try {
          // 刷新接口从 HttpOnly Cookie 中读取 refresh_token，无需前端传参
          const { data } = await api.post('/auth/refresh')
          if (data.success) {
            const { accessToken } = data.data as { accessToken: string }

            // 更新可读 access token（供拦截器继续注入）
            const tokenCookie = useCookie('token')
            tokenCookie.value = accessToken

            if (process.client) {
              localStorage.setItem('auth_access_token', accessToken)
            }

            if (originalRequest.headers instanceof AxiosHeaders) {
              originalRequest.headers.set('Authorization', `Bearer ${accessToken}`)
            } else {
              originalRequest.headers = {
                ...(originalRequest.headers ?? {}),
                Authorization: `Bearer ${accessToken}`
              }
            }
            return api(originalRequest)
          }
        } catch {
          if (process.client) {
            localStorage.removeItem('auth_access_token')
            document.cookie = 'token=; path=/; max-age=0'
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
