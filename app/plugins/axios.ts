import { defineNuxtPlugin, useRuntimeConfig, useCookie } from '#app'
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { createApiClient } from '~/utils/request'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const api = createApiClient({ baseURL: config.public.apiBase })

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

  return {
    provide: {
      api
    }
  }
})
