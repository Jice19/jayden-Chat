export interface ApiError {
  status: number
  message: string
  data?: unknown
}

export interface ApiResult<T> {
  success: boolean
  message?: string
  data: T
}

export interface AiReplyResult {
  success: boolean
  message?: string
  reply: string
}
