import type { AxiosInstance } from 'axios'
import { useNuxtApp } from '#app'

export const useApi = (): AxiosInstance => {
  const nuxtApp = useNuxtApp() as unknown as { $api: AxiosInstance }
  return nuxtApp.$api
}
