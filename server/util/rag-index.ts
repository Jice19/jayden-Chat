import { readFile } from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'
import type { RagStoredDocument } from './rag-kb-store'
import { getFinalFilePath, upsertRagDocument } from './rag-kb-store'
import { getApiKey } from './get-api-key'

export interface RagChunkRecord {
  id: string
  userId: string
  documentId: string
  title: string
  chunkIndex: number
  content: string
  createdAt: string
}

const prisma = (global as { prisma?: PrismaClient }).prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') {
  ;(global as { prisma?: PrismaClient }).prisma = prisma
}

let _ragSchemaReady = false
let _ragMode: 'vector' | 'keyword' = 'vector'

async function ensureRagSchemaReady(): Promise<void> {
  if (_ragSchemaReady) return
  try {
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS rag_chunks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        title TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding vector,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    await prisma.$executeRawUnsafe('ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS embedding vector;')
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS idx_rag_chunks_user_doc ON rag_chunks(user_id, document_id, chunk_index);'
    )
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding ON rag_chunks USING hnsw (embedding vector_cosine_ops);'
    )
    _ragMode = 'vector'
  } catch (error) {
    // 未安装 pgvector 时自动降级为关键词检索，保证系统可用
    _ragMode = 'keyword'
    console.warn('[RAG] pgvector 不可用，已降级为关键词检索:', (error as Error).message)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS rag_chunks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        title TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS idx_rag_chunks_user_doc ON rag_chunks(user_id, document_id, chunk_index);'
    )
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS idx_rag_chunks_user_created ON rag_chunks(user_id, created_at DESC);'
    )
    // 兼容历史表结构：若 embedding 存在且是 NOT NULL，关键词模式写入会失败，这里放宽为可空
    await prisma.$executeRawUnsafe('ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS embedding vector;')
    await prisma.$executeRawUnsafe('ALTER TABLE rag_chunks ALTER COLUMN embedding DROP NOT NULL;')
  } finally {
    _ragSchemaReady = true
  }
}

function splitTextToChunks(text: string, chunkSize = 700, overlap = 120): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const chunks: string[] = []
  let cursor = 0
  while (cursor < normalized.length) {
    const end = Math.min(normalized.length, cursor + chunkSize)
    const slice = normalized.slice(cursor, end).trim()
    if (slice) {
      chunks.push(slice)
    }
    if (end >= normalized.length) break
    cursor = Math.max(0, end - overlap)
  }
  return chunks
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/g)
    .map((token) => token.trim())
    .filter(Boolean)
}

function scoreChunk(question: string, chunk: string, title?: string): number {
  const qTokens = tokenize(question)
  const cTokens = tokenize(chunk)
  if (qTokens.length === 0 || cTokens.length === 0) return 0

  const freq = new Map<string, number>()
  for (const token of cTokens) {
    freq.set(token, (freq.get(token) || 0) + 1)
  }

  let score = 0
  for (const token of qTokens) {
    score += freq.get(token) || 0
  }

  const questionLower = question.toLowerCase()
  if (chunk.toLowerCase().includes(questionLower)) {
    score += 4
  }
  if (title) {
    const titleLower = title.toLowerCase()
    if (qTokens.some((token) => titleLower.includes(token))) {
      score += 3
    }
    if (/面试|面经/.test(question) && /面试|面经/.test(title)) {
      score += 8
    }
  }
  return score
}

function selectDiverseChunks(
  chunks: Array<RagChunkRecord & { score: number }>,
  topK: number
): Array<RagChunkRecord & { score: number }> {
  if (chunks.length <= topK) return chunks

  const groups = new Map<string, Array<RagChunkRecord & { score: number }>>()
  for (const chunk of chunks) {
    const list = groups.get(chunk.documentId) || []
    list.push(chunk)
    groups.set(chunk.documentId, list)
  }

  const orderedDocIds = [...groups.entries()]
    .sort((a, b) => (b[1][0]?.score || 0) - (a[1][0]?.score || 0))
    .map(([docId]) => docId)

  const result: Array<RagChunkRecord & { score: number }> = []
  let cursor = 0
  while (result.length < topK && orderedDocIds.length > 0) {
    const docId = orderedDocIds[cursor % orderedDocIds.length]
    if (!docId) {
      break
    }
    const group = groups.get(docId)
    if (group && group.length > 0) {
      const item = group.shift()
      if (item) {
        result.push(item)
      }
      if (group.length === 0) {
        groups.delete(docId)
        const removeIndex = orderedDocIds.indexOf(docId)
        if (removeIndex >= 0) {
          orderedDocIds.splice(removeIndex, 1)
        }
        cursor = 0
        continue
      }
    }
    cursor += 1
  }

  return result
}

async function readSupportedTextDocument(userId: string, document: RagStoredDocument): Promise<string> {
  const filePath = getFinalFilePath(userId, document.storedName)
  const ext = (document.ext || '').toLowerCase()
  if (ext !== 'md' && ext !== 'txt') {
    throw new Error('当前仅支持 md/txt 自动入库，pdf 将在后续版本支持解析')
  }
  return readFile(filePath, 'utf-8')
}

function toVectorLiteral(values: number[]): string {
  const safe = values.map((value) => (Number.isFinite(value) ? Number(value) : 0))
  return `[${safe.join(',')}]`
}

interface EmbeddingResponse {
  data?: Array<{
    embedding?: number[]
    index?: number
  }>
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-v3',
      input: texts
    })
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`向量化失败: ${response.status}${body ? ` - ${body}` : ''}`)
  }
  const payload = (await response.json()) as EmbeddingResponse
  const embeddings = (payload.data || [])
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((item) => item.embedding || [])
  if (embeddings.length !== texts.length) {
    throw new Error('向量化返回数量与输入文本不一致')
  }
  return embeddings
}

export async function ingestDocumentToRag(userId: string, document: RagStoredDocument): Promise<number> {
  try {
    await ensureRagSchemaReady()
    const rawText = await readSupportedTextDocument(userId, document)
    const chunks = splitTextToChunks(rawText)
    if (chunks.length === 0) {
      throw new Error('文档内容为空，无法建立索引')
    }

    const now = new Date().toISOString()
    await prisma.$executeRawUnsafe(
      'DELETE FROM rag_chunks WHERE user_id = $1 AND document_id = $2',
      userId,
      document.id
    )

    if (_ragMode === 'vector') {
      const batchSize = 20
      for (let start = 0; start < chunks.length; start += batchSize) {
        const end = Math.min(start + batchSize, chunks.length)
        const batch = chunks.slice(start, end)
        const vectors = await embedTexts(batch)

        for (let i = 0; i < batch.length; i += 1) {
          const chunkIndex = start + i
          const content = batch[i]
          const vector = vectors[i] || []
          await prisma.$executeRawUnsafe(
            `
            INSERT INTO rag_chunks (id, user_id, document_id, title, chunk_index, content, embedding, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8::timestamptz)
            ON CONFLICT (id) DO UPDATE SET
              user_id = EXCLUDED.user_id,
              document_id = EXCLUDED.document_id,
              title = EXCLUDED.title,
              chunk_index = EXCLUDED.chunk_index,
              content = EXCLUDED.content,
              embedding = EXCLUDED.embedding,
              created_at = EXCLUDED.created_at
            `,
            `${document.id}::${chunkIndex}`,
            userId,
            document.id,
            document.originalName,
            chunkIndex,
            content,
            toVectorLiteral(vector),
            now
          )
        }
      }
    } else {
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        const content = chunks[chunkIndex]
        await prisma.$executeRawUnsafe(
          `
          INSERT INTO rag_chunks (id, user_id, document_id, title, chunk_index, content, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz)
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            document_id = EXCLUDED.document_id,
            title = EXCLUDED.title,
            chunk_index = EXCLUDED.chunk_index,
            content = EXCLUDED.content,
            created_at = EXCLUDED.created_at
          `,
          `${document.id}::${chunkIndex}`,
          userId,
          document.id,
          document.originalName,
          chunkIndex,
          content,
          now
        )
      }
    }

    await upsertRagDocument(userId, {
      ...document,
      indexStatus: 'READY',
      indexedAt: now,
      indexError: ''
    })
    return chunks.length
  } catch (error) {
    await upsertRagDocument(userId, {
      ...document,
      indexStatus: 'FAILED',
      indexedAt: new Date().toISOString(),
      indexError: (error as Error).message
    })
    throw error
  }
}

export async function searchRagChunks(input: {
  userId: string
  question: string
  topK: number
  documentIds?: string[]
}): Promise<Array<RagChunkRecord & { score: number }>> {
  await ensureRagSchemaReady()
  const limit = Math.max(input.topK * 6, input.topK)

  type VectorRow = {
    id: string
    user_id: string
    document_id: string
    title: string
    chunk_index: number
    content: string
    score: number
  }

  if (_ragMode === 'vector') {
    const [queryEmbedding] = await embedTexts([input.question])
    if (!queryEmbedding || queryEmbedding.length === 0) {
      return []
    }
    const vectorLiteral = toVectorLiteral(queryEmbedding)
    let rows: VectorRow[] = []
    if (input.documentIds && input.documentIds.length > 0) {
      rows = await prisma.$queryRawUnsafe<VectorRow[]>(
        `
        SELECT
          id,
          user_id,
          document_id,
          title,
          chunk_index,
          content,
          GREATEST(0, 1 - (embedding <=> $1::vector)) AS score
        FROM rag_chunks
        WHERE user_id = $2
          AND document_id = ANY($3::text[])
        AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector ASC
        LIMIT $4
        `,
        vectorLiteral,
        input.userId,
        input.documentIds,
        limit
      )
    } else {
      rows = await prisma.$queryRawUnsafe<VectorRow[]>(
        `
        SELECT
          id,
          user_id,
          document_id,
          title,
          chunk_index,
          content,
          GREATEST(0, 1 - (embedding <=> $1::vector)) AS score
        FROM rag_chunks
        WHERE user_id = $2
        AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector ASC
        LIMIT $3
        `,
        vectorLiteral,
        input.userId,
        limit
      )
    }

    const normalized = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      documentId: row.document_id,
      title: row.title,
      chunkIndex: Number(row.chunk_index),
      content: row.content,
      createdAt: '',
      score: Number(row.score)
    }))
    return selectDiverseChunks(normalized, input.topK)
  }

  type KeywordRow = {
    id: string
    user_id: string
    document_id: string
    title: string
    chunk_index: number
    content: string
    created_at: Date
  }
  let rows: KeywordRow[] = []
  if (input.documentIds && input.documentIds.length > 0) {
    rows = await prisma.$queryRawUnsafe<KeywordRow[]>(
      `
      SELECT id, user_id, document_id, title, chunk_index, content, created_at
      FROM rag_chunks
      WHERE user_id = $1
        AND document_id = ANY($2::text[])
      ORDER BY created_at DESC
      LIMIT $3
      `,
      input.userId,
      input.documentIds,
      limit
    )
  } else {
    rows = await prisma.$queryRawUnsafe<KeywordRow[]>(
      `
      SELECT id, user_id, document_id, title, chunk_index, content, created_at
      FROM rag_chunks
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      `,
      input.userId,
      limit
    )
  }

  const scored = rows
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      documentId: row.document_id,
      title: row.title,
      chunkIndex: Number(row.chunk_index),
      content: row.content,
      createdAt: row.created_at.toISOString(),
      score: scoreChunk(input.question, row.content, row.title)
    }))
    .sort((a, b) => b.score - a.score)

  const positive = selectDiverseChunks(scored.filter((item) => item.score > 0), input.topK)
  if (positive.length > 0) {
    return positive
  }
  return selectDiverseChunks(scored, input.topK)
}

export function buildRagContext(chunks: Array<RagChunkRecord & { score: number }>): string {
  return chunks
    .map((chunk, index) => `[${index + 1}] ${chunk.title}#${chunk.chunkIndex}\n${chunk.content}`)
    .join('\n\n')
}

export async function getIndexedDocumentIds(userId: string): Promise<Set<string>> {
  await ensureRagSchemaReady()
  const rows = await prisma.$queryRawUnsafe<Array<{ document_id: string }>>(
    'SELECT DISTINCT document_id FROM rag_chunks WHERE user_id = $1',
    userId
  )
  return new Set(rows.map((row) => row.document_id))
}
