export interface ImageGenRequest {
  prompt: string
  size?: '1024*1024' | '1280*720' | '720*1280' | '1280*1280'
  negativePrompt?: string
  promptExtend?: boolean
}

export interface ImageGenResult {
  url: string
  prompt: string
  size: string
  createdAt: string
}

export interface ImageGenResponse {
  success: boolean
  result?: ImageGenResult
  message?: string
}
