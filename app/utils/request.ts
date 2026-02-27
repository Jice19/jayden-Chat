import axios, { AxiosHeaders, type AxiosError, type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'

export interface ApiError {
  status: number
  message: string
  data?: unknown
}

const normalizeError = (error: unknown): ApiError => {
  const axiosError = axios.isAxiosError(error) ? error : null
  if (axiosError) {
    const status = axiosError.response?.status ?? 0
    const message =
      (axiosError.response?.data as { message?: string } | undefined)?.message ||
      axiosError.message ||
      '请求失败'
    return { status, message, data: axiosError.response?.data }
  }

  return { status: 0, message: '请求失败' }
}

export const createApiClient = (config: { baseURL: string }): AxiosInstance => {
  const instance = axios.create({
    baseURL: config.baseURL,
    timeout: 15000,
    withCredentials: true
  })

  instance.interceptors.request.use(
    (request: InternalAxiosRequestConfig) => {
      const headers = request.headers
      if (headers instanceof AxiosHeaders) {
        if (!headers.get('Content-Type')) {
          headers.set('Content-Type', 'application/json')
        }
      } else {
        const headerObject = (headers ?? {}) as Record<string, string>
        request.headers = {
          ...headerObject,
          'Content-Type': headerObject['Content-Type'] ?? 'application/json'
        } as typeof request.headers
      }
      return request
    },
    (error: AxiosError) => Promise.reject(normalizeError(error))
  )

  instance.interceptors.response.use(
    (response: AxiosResponse) => response.data,
    (error: AxiosError) => Promise.reject(normalizeError(error))
  )

  return instance
}
