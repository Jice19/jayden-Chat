export interface ChatMessage {
  id?: string
  content: string
  isUser: boolean
  createdAt?: string
  sessionId?: string | null
}

export interface Session {
  id: string
  title: string
  createdAt: string
  chats?: ChatMessage[]
}
