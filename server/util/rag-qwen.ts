import { ChatOpenAI } from '@langchain/openai'
import { getApiKey } from './get-api-key'

interface EmbeddingItem {
  embedding?: number[]
  index?: number
}

interface EmbeddingResponse {
  data?: EmbeddingItem[]
}

interface QueryExpansionSchema {
  queries: string[]
}

interface ChunkSummarySchema {
  summary: string
  keywords: string[]
}

interface RerankResultItem {
  index: number
  relevanceScore: number
}

interface CompatibleRerankPayload {
  results?: Array<{
    index?: number
    relevance_score?: number
  }>
}

interface DashscopeRerankPayload {
  output?: {
    results?: Array<{
      index?: number
      relevance_score?: number
    }>
  }
}

let _chatLlm: ChatOpenAI | null = null

function getDashscopeCompatibleBaseUrl(): string {
  return process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
}

function getRerankCompatibleUrl(): string {
  return process.env.DASHSCOPE_RERANK_URL || 'https://dashscope.aliyuncs.com/compatible-api/v1/reranks'
}

function getRerankDashscopeUrl(): string {
  return (
    process.env.DASHSCOPE_RERANK_DASHSCOPE_URL ||
    'https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank'
  )
}

function getChatLlm(): ChatOpenAI {
  if (_chatLlm) return _chatLlm
  _chatLlm = new ChatOpenAI({
    modelName: process.env.RAG_QWEN_CHAT_MODEL || 'qwen-plus',
    openAIApiKey: getApiKey(),
    configuration: {
      baseURL: getDashscopeCompatibleBaseUrl()
    },
    temperature: 0.2,
    maxTokens: 1200
  })
  return _chatLlm
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export async function embedTextsWithQwen(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const batchSize = 10
  const vectors: number[][] = []
  for (let start = 0; start < texts.length; start += batchSize) {
    const end = Math.min(start + batchSize, texts.length)
    const batch = texts.slice(start, end)
    const response = await fetch(`${getDashscopeCompatibleBaseUrl()}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.RAG_QWEN_EMBEDDING_MODEL || 'text-embedding-v3',
        input: batch
      })
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`Qwen Embedding 调用失败: ${response.status}${body ? ` - ${body}` : ''}`)
    }
    const payload = (await response.json()) as EmbeddingResponse
    const batchVectors = (payload.data || [])
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((item) => item.embedding || [])
    if (batchVectors.length !== batch.length) {
      throw new Error('Qwen Embedding 返回数量与输入不一致')
    }
    vectors.push(...batchVectors)
  }
  return vectors
}

export async function summarizeChunkWithQwen(chunk: string): Promise<ChunkSummarySchema> {
  const llm = getChatLlm()
  const response = await llm.invoke([
    {
      role: 'system',
      content:
        '你是RAG摘要索引助手。请输出严格 JSON，结构为 {"summary":"...","keywords":["..."]}。keywords返回3到8个关键词，避免空数组。'
    },
    {
      role: 'user',
      content: `请为以下文本生成摘要与关键词：\n${chunk}`
    }
  ])
  const raw = String(response.content || '').trim()
  const parsed = safeJsonParse<ChunkSummarySchema>(raw, {
    summary: chunk.slice(0, 180),
    keywords: []
  })
  const summary = String(parsed.summary || '').trim() || chunk.slice(0, 180)
  const keywords = Array.isArray(parsed.keywords)
    ? parsed.keywords.map((item) => String(item).trim()).filter(Boolean).slice(0, 12)
    : []
  return { summary, keywords }
}

export async function expandQueriesWithQwen(
  question: string,
  expansionCount: number
): Promise<string[]> {
  const llm = getChatLlm()
  const count = Math.max(1, Math.min(5, expansionCount))
  const response = await llm.invoke([
    {
      role: 'system',
      content:
        '你是检索查询扩展助手。请输出严格 JSON，结构为 {"queries":["..."]}，给出语义相似但表达不同的问题。'
    },
    {
      role: 'user',
      content: `原始问题：${question}\n请生成 ${count} 条检索查询扩展。`
    }
  ])
  const raw = String(response.content || '').trim()
  const parsed = safeJsonParse<QueryExpansionSchema>(raw, { queries: [] })
  const generated = Array.isArray(parsed.queries)
    ? parsed.queries.map((item) => String(item).trim()).filter(Boolean)
    : []
  const dedup = Array.from(new Set([question, ...generated]))
  return dedup.slice(0, count + 1)
}

async function rerankWithCompatibleApi(
  query: string,
  documents: string[],
  topN: number
): Promise<RerankResultItem[]> {
  const response = await fetch(getRerankCompatibleUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.RAG_QWEN_RERANK_MODEL || 'qwen3-rerank',
      query,
      documents,
      top_n: topN,
      return_documents: false
    })
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Rerank(compatible) 调用失败: ${response.status}${body ? ` - ${body}` : ''}`)
  }
  const payload = (await response.json()) as CompatibleRerankPayload
  return (payload.results || []).map((item) => ({
    index: Number(item.index ?? -1),
    relevanceScore: Number(item.relevance_score ?? 0)
  }))
}

async function rerankWithDashscopeApi(
  query: string,
  documents: string[],
  topN: number
): Promise<RerankResultItem[]> {
  const response = await fetch(getRerankDashscopeUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.RAG_QWEN_RERANK_MODEL || 'qwen3-rerank',
      input: {
        query,
        documents
      },
      parameters: {
        top_n: topN,
        return_documents: false
      }
    })
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Rerank(dashscope) 调用失败: ${response.status}${body ? ` - ${body}` : ''}`)
  }
  const payload = (await response.json()) as DashscopeRerankPayload
  return (payload.output?.results || []).map((item) => ({
    index: Number(item.index ?? -1),
    relevanceScore: Number(item.relevance_score ?? 0)
  }))
}

export async function rerankWithQwen(
  query: string,
  documents: string[],
  topN: number
): Promise<RerankResultItem[]> {
  if (documents.length === 0) return []
  const safeTopN = Math.max(1, Math.min(documents.length, topN))
  try {
    return await rerankWithCompatibleApi(query, documents, safeTopN)
  } catch {
    return rerankWithDashscopeApi(query, documents, safeTopN)
  }
}

export function getAnswerLlm(): ChatOpenAI {
  return getChatLlm()
}
