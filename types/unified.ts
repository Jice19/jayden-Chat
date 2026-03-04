/** 统一智能助手 API 的响应结构，前后端共用 */
export interface UnifiedResponse {
  intent: 'text' | 'image' | 'both'
  textReply: string
  imageUrl: string
  error: string
}
