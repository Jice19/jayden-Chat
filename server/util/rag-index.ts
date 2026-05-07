import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { PrismaClient } from '@prisma/client'
import { type RagStoredDocument, getFinalFilePath, upsertRagDocument } from './rag-kb-store'
import {
  type RagSummarySearchResult,
  deleteVectorsByDocumentIds,
  querySummaryVectors,
  upsertSummaryVectors
} from './rag-chroma'
import {
  embedTextsWithQwen,
  expandQueriesWithQwen,
  rerankWithQwen,
  summarizeChunkWithQwen
} from './rag-qwen'

export interface RagChunkRecord {
  id: string
  userId: string
  documentId: string
  title: string
  chunkIndex: number
  content: string
  summaryUuid: string
  summary: string
  keywords: string[]
  createdAt: string
}

export interface RagDebugTrace {
  queryExpansion: string[]
  recallCandidates: Array<{
    summaryUuid: string
    documentId: string
    chunkId: string
    distance: number
    score: number
  }>
  keywordMatches: Array<{
    summaryUuid: string
    keywordScore: number
  }>
  rerankScores: Array<{
    chunkId: string
    score: number
  }>
  finalContext: Array<{
    chunkId: string
    documentId: string
    title: string
    chunkIndex: number
  }>
  latency: {
    recallMs: number
    rerankMs: number
    totalMs: number
  }
  traceId: string
  rerankDegraded: boolean
}

interface RagPipelineInput {
  userId: string
  question: string
  recallTopK: number
  rerankTopN: number
  queryExpansionCount: number
  documentIds?: string[]
}

interface RagPipelineResult {
  chunks: Array<RagChunkRecord & { score: number }>
  debugTrace: RagDebugTrace
}

interface RagSummaryRow {
  summary_uuid: string
  chunk_id: string
  document_id: string
  user_id: string
  summary_text: string
  keywords: unknown
}

const prisma = (global as { prisma?: PrismaClient }).prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') {
  ;(global as { prisma?: PrismaClient }).prisma = prisma
}

let _ragSchemaReady = false

async function ensureRagSchemaReady(): Promise<void> {
  if (_ragSchemaReady) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rag_chunks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      title TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      summary_uuid TEXT NOT NULL,
      keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
  // 兼容历史表结构：旧表可能缺少 summary_uuid/keywords 列
  await prisma.$executeRawUnsafe('ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS summary_uuid TEXT;')
  await prisma.$executeRawUnsafe(
    "ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS keywords JSONB NOT NULL DEFAULT '[]'::jsonb;"
  )

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rag_summary_index (
      summary_uuid TEXT PRIMARY KEY,
      chunk_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      summary_text TEXT NOT NULL,
      keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
  // 兼容历史表结构：若表已存在但字段不完整，补齐列
  await prisma.$executeRawUnsafe(
    'ALTER TABLE rag_summary_index ADD COLUMN IF NOT EXISTS summary_uuid TEXT;'
  )
  await prisma.$executeRawUnsafe(
    'ALTER TABLE rag_summary_index ADD COLUMN IF NOT EXISTS chunk_id TEXT;'
  )
  await prisma.$executeRawUnsafe(
    'ALTER TABLE rag_summary_index ADD COLUMN IF NOT EXISTS document_id TEXT;'
  )
  await prisma.$executeRawUnsafe(
    'ALTER TABLE rag_summary_index ADD COLUMN IF NOT EXISTS user_id TEXT;'
  )
  await prisma.$executeRawUnsafe(
    'ALTER TABLE rag_summary_index ADD COLUMN IF NOT EXISTS summary_text TEXT;'
  )
  await prisma.$executeRawUnsafe(
    "ALTER TABLE rag_summary_index ADD COLUMN IF NOT EXISTS keywords JSONB NOT NULL DEFAULT '[]'::jsonb;"
  )
  await prisma.$executeRawUnsafe(
    'ALTER TABLE rag_summary_index ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();'
  )

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS idx_rag_chunks_user_doc ON rag_chunks(user_id, document_id, chunk_index);'
  )
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS idx_rag_summary_user_doc ON rag_summary_index(user_id, document_id);'
  )
  _ragSchemaReady = true
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/g)
    .map((token) => token.trim())
    .filter(Boolean)
}

function keywordMatchScore(question: string, keywords: string[]): number {
  if (keywords.length === 0) return 0
  const qTokens = new Set(tokenize(question))
  let score = 0
  for (const keyword of keywords) {
    const tokens = tokenize(keyword)
    for (const token of tokens) {
      if (qTokens.has(token)) score += 1
    }
  }
  return score
}

async function readSupportedTextDocument(userId: string, document: RagStoredDocument): Promise<string> {
  const filePath = getFinalFilePath(userId, document.storedName)
  const ext = (document.ext || '').toLowerCase()
  if (ext !== 'md' && ext !== 'txt') {
    throw new Error('当前仅支持 md/txt 自动入库，pdf 将在后续版本支持解析')
  }
  return readFile(filePath, 'utf-8')
}

function parseKeywords(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    const parsed = (() => {
      try {
        return JSON.parse(raw) as unknown
      } catch {
        return null
      }
    })()
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean)
    }
  }
  return []
}

async function splitDocumentByRecursiveStrategy(content: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: Number(process.env.RAG_CHUNK_SIZE || 800),
    chunkOverlap: Number(process.env.RAG_CHUNK_OVERLAP || 120),
    separators: ['\n\n', '\n', '。', '；', '，', ' ', '']
  })
  return splitter.splitText(content)
}

export async function ingestDocumentToRag(userId: string, document: RagStoredDocument): Promise<number> {
  try {
    await ensureRagSchemaReady()
    const rawText = await readSupportedTextDocument(userId, document)
    const chunks = await splitDocumentByRecursiveStrategy(rawText)
    const normalizedChunks = chunks.map((item) => item.trim()).filter(Boolean)
    if (normalizedChunks.length === 0) {
      throw new Error('文档内容为空，无法建立索引')
    }

    await prisma.$executeRawUnsafe(
      'DELETE FROM rag_chunks WHERE user_id = $1 AND document_id = $2',
      userId,
      document.id
    )
    await prisma.$executeRawUnsafe(
      'DELETE FROM rag_summary_index WHERE user_id = $1 AND document_id = $2',
      userId,
      document.id
    )
    await deleteVectorsByDocumentIds(userId, [document.id])

    const summaries = await Promise.all(
      normalizedChunks.map(async (chunk) => {
        const summaryResult = await summarizeChunkWithQwen(chunk)
        return summaryResult
      })
    )
    const summaryTexts = summaries.map((item) => item.summary)
    const embeddings = await embedTextsWithQwen(summaryTexts)
    const now = new Date().toISOString()

    const vectorRows = []
    for (let chunkIndex = 0; chunkIndex < normalizedChunks.length; chunkIndex += 1) {
      const chunkId = randomUUID()
      const summaryUuid = randomUUID()
      const content = normalizedChunks[chunkIndex] || ''
      const summary = summaries[chunkIndex]?.summary || content.slice(0, 180)
      const keywords = summaries[chunkIndex]?.keywords || []
      const embedding = embeddings[chunkIndex] || []
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO rag_chunks (id, user_id, document_id, title, chunk_index, content, summary_uuid, keywords, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::timestamptz)
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            document_id = EXCLUDED.document_id,
            title = EXCLUDED.title,
            chunk_index = EXCLUDED.chunk_index,
            content = EXCLUDED.content,
            summary_uuid = EXCLUDED.summary_uuid,
            keywords = EXCLUDED.keywords,
            created_at = EXCLUDED.created_at
        `,
        chunkId,
        userId,
        document.id,
        document.originalName,
        chunkIndex,
        content,
        summaryUuid,
        JSON.stringify(keywords),
        now
      )
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO rag_summary_index (summary_uuid, chunk_id, document_id, user_id, summary_text, keywords, created_at)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz)
          ON CONFLICT (summary_uuid) DO UPDATE SET
            chunk_id = EXCLUDED.chunk_id,
            document_id = EXCLUDED.document_id,
            user_id = EXCLUDED.user_id,
            summary_text = EXCLUDED.summary_text,
            keywords = EXCLUDED.keywords,
            created_at = EXCLUDED.created_at
        `,
        summaryUuid,
        chunkId,
        document.id,
        userId,
        summary,
        JSON.stringify(keywords),
        now
      )
      vectorRows.push({
        summaryUuid,
        summaryText: summary,
        embedding,
        userId,
        documentId: document.id,
        chunkId,
        title: document.originalName,
        chunkIndex,
        keywords
      })
    }
    await upsertSummaryVectors(vectorRows)
    await upsertRagDocument(userId, {
      ...document,
      indexStatus: 'READY',
      indexedAt: now,
      indexError: ''
    })
    return normalizedChunks.length
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

function mergeRecallRows(rows: RagSummarySearchResult[]): Array<RagSummarySearchResult & { score: number }> {
  const merged = new Map<string, RagSummarySearchResult & { score: number }>()
  for (const row of rows) {
    const score = Math.max(0, 1 - Number(row.distance || 1))
    const current = merged.get(row.summaryUuid)
    if (!current || score > current.score) {
      merged.set(row.summaryUuid, { ...row, score })
    }
  }
  return [...merged.values()]
}

async function loadChunkBySummaryUuid(
  userId: string,
  summaryUuid: string
): Promise<RagChunkRecord | null> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      user_id: string
      document_id: string
      title: string
      chunk_index: number
      content: string
      summary_uuid: string
      keywords: unknown
      created_at: Date
    }>
  >(
    `
      SELECT id, user_id, document_id, title, chunk_index, content, summary_uuid, keywords, created_at
      FROM rag_chunks
      WHERE user_id = $1 AND summary_uuid = $2
      LIMIT 1
    `,
    userId,
    summaryUuid
  )
  const row = rows[0]
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    documentId: row.document_id,
    title: row.title,
    chunkIndex: Number(row.chunk_index),
    content: row.content,
    summaryUuid: row.summary_uuid,
    summary: '',
    keywords: parseKeywords(row.keywords),
    createdAt: row.created_at.toISOString()
  }
}

async function loadSummariesByIds(summaryUuids: string[]): Promise<Map<string, RagSummaryRow>> {
  if (summaryUuids.length === 0) return new Map()
  const rows = await prisma.$queryRawUnsafe<RagSummaryRow[]>(
    `
      SELECT summary_uuid, chunk_id, document_id, user_id, summary_text, keywords
      FROM rag_summary_index
      WHERE summary_uuid = ANY($1::text[])
    `,
    summaryUuids
  )
  const map = new Map<string, RagSummaryRow>()
  for (const row of rows) {
    map.set(row.summary_uuid, row)
  }
  return map
}

export async function runRagPipeline(input: RagPipelineInput): Promise<RagPipelineResult> {
  await ensureRagSchemaReady()
  const traceId = randomUUID()
  const startAt = Date.now()
  const recallStartAt = Date.now()

  const expandedQueries = await expandQueriesWithQwen(input.question, input.queryExpansionCount)
  const queryEmbeddings = await embedTextsWithQwen(expandedQueries)
  const rawRecallRows = await querySummaryVectors({
    userId: input.userId,
    embeddings: queryEmbeddings,
    topK: Math.max(20, input.recallTopK),
    documentIds: input.documentIds
  })
  const mergedRows = mergeRecallRows(rawRecallRows)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(20, input.recallTopK))

  const summaryMap = await loadSummariesByIds(mergedRows.map((item) => item.summaryUuid))
  const keywordMatches = mergedRows.map((row) => {
    const summary = summaryMap.get(row.summaryUuid)
    const keywords = parseKeywords(summary?.keywords || row.keywords)
    return {
      summaryUuid: row.summaryUuid,
      keywordScore: keywordMatchScore(input.question, keywords)
    }
  })

  const sortedByKeyword = [...mergedRows].sort((a, b) => {
    const scoreA = keywordMatches.find((item) => item.summaryUuid === a.summaryUuid)?.keywordScore || 0
    const scoreB = keywordMatches.find((item) => item.summaryUuid === b.summaryUuid)?.keywordScore || 0
    const totalA = a.score + scoreA * 0.05
    const totalB = b.score + scoreB * 0.05
    return totalB - totalA
  })

  const candidates: Array<RagChunkRecord & { score: number }> = []
  for (const row of sortedByKeyword) {
    const chunk = await loadChunkBySummaryUuid(input.userId, row.summaryUuid)
    if (!chunk) continue
    const summaryRow = summaryMap.get(row.summaryUuid)
    candidates.push({
      ...chunk,
      summary: summaryRow?.summary_text || row.summaryText,
      keywords: parseKeywords(summaryRow?.keywords || chunk.keywords),
      score: row.score
    })
  }
  const recallEndAt = Date.now()

  const rerankStartAt = Date.now()
  const rerankTopN = Math.max(1, input.rerankTopN)
  const rerankDocuments = candidates.map((item) => `${item.title}\n${item.summary}\n${item.content}`)
  let rerankDegraded = false
  let reranked = candidates
  try {
    const rerankResults = await rerankWithQwen(input.question, rerankDocuments, rerankTopN)
    const byChunk = new Map<string, number>()
    for (const item of rerankResults) {
      if (item.index < 0 || item.index >= candidates.length) continue
      const candidate = candidates[item.index]
      if (!candidate) continue
      byChunk.set(candidate.id, item.relevanceScore)
    }
    reranked = [...candidates]
      .sort((a, b) => {
        const scoreA = byChunk.get(a.id) ?? -1
        const scoreB = byChunk.get(b.id) ?? -1
        return scoreB - scoreA
      })
      .slice(0, rerankTopN)
      .map((item) => ({
        ...item,
        score: byChunk.get(item.id) ?? item.score
      }))
  } catch {
    rerankDegraded = true
    reranked = candidates.slice(0, rerankTopN)
  }
  const rerankEndAt = Date.now()

  const debugTrace: RagDebugTrace = {
    queryExpansion: expandedQueries,
    recallCandidates: mergedRows.map((item) => ({
      summaryUuid: item.summaryUuid,
      documentId: item.documentId,
      chunkId: item.chunkId,
      distance: item.distance,
      score: item.score
    })),
    keywordMatches,
    rerankScores: reranked.map((item) => ({
      chunkId: item.id,
      score: item.score
    })),
    finalContext: reranked.map((item) => ({
      chunkId: item.id,
      documentId: item.documentId,
      title: item.title,
      chunkIndex: item.chunkIndex
    })),
    latency: {
      recallMs: recallEndAt - recallStartAt,
      rerankMs: rerankEndAt - rerankStartAt,
      totalMs: Date.now() - startAt
    },
    traceId,
    rerankDegraded
  }
  return {
    chunks: reranked,
    debugTrace
  }
}

export async function searchRagChunks(input: {
  userId: string
  question: string
  topK: number
  documentIds?: string[]
}): Promise<Array<RagChunkRecord & { score: number }>> {
  const result = await runRagPipeline({
    userId: input.userId,
    question: input.question,
    recallTopK: Math.max(20, input.topK),
    rerankTopN: input.topK,
    queryExpansionCount: 3,
    documentIds: input.documentIds
  })
  return result.chunks
}

export function buildRagContext(chunks: Array<RagChunkRecord & { score: number }>): string {
  return chunks
    .map(
      (chunk, index) =>
        `[${index + 1}] ${chunk.title}#${chunk.chunkIndex}\n摘要：${chunk.summary || '-'}\n内容：${chunk.content}`
    )
    .join('\n\n')
}

export async function getIndexedDocumentIds(userId: string): Promise<Set<string>> {
  await ensureRagSchemaReady()
  const rows = await prisma.$queryRawUnsafe<Array<{ document_id: string }>>(
    'SELECT DISTINCT document_id FROM rag_summary_index WHERE user_id = $1',
    userId
  )
  return new Set(rows.map((row) => row.document_id))
}
