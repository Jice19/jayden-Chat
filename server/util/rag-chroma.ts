import { Document } from '@langchain/core/documents'
import type { EmbeddingsInterface } from '@langchain/core/embeddings'
import { Chroma } from '@langchain/community/vectorstores/chroma'
import type { Where } from 'chromadb'
import { embedTextsWithQwen } from './rag-qwen'

export interface RagSummaryVectorRecord {
  summaryUuid: string
  summaryText: string
  embedding: number[]
  userId: string
  documentId: string
  chunkId: string
  title: string
  chunkIndex: number
  keywords: string[]
}

export interface RagSummarySearchResult {
  summaryUuid: string
  distance: number
  userId: string
  documentId: string
  chunkId: string
  title: string
  chunkIndex: number
  keywords: string[]
  summaryText: string
}

const CHROMA_COLLECTION_NAME = process.env.RAG_CHROMA_COLLECTION || 'rag_summary_index'

let _vectorStore: Chroma | null = null

function getChromaUrl(): string {
  return process.env.CHROMA_URL || 'http://localhost:8000'
}

function getEmbeddingAdapter(): EmbeddingsInterface<number[]> {
  return {
    async embedDocuments(documents: string[]): Promise<number[][]> {
      return embedTextsWithQwen(documents)
    },
    async embedQuery(document: string): Promise<number[]> {
      const [vector] = await embedTextsWithQwen([document])
      return vector || []
    }
  }
}

async function getVectorStore(): Promise<Chroma> {
  if (_vectorStore) return _vectorStore
  _vectorStore = new Chroma(getEmbeddingAdapter(), {
    url: getChromaUrl(),
    collectionName: CHROMA_COLLECTION_NAME
  })
  await _vectorStore.ensureCollection()
  return _vectorStore
}

export async function upsertSummaryVectors(records: RagSummaryVectorRecord[]): Promise<void> {
  if (records.length === 0) return
  const vectorStore = await getVectorStore()
  const ids = records.map((item) => item.summaryUuid)
  await vectorStore.delete({ ids }).catch(() => undefined)
  const docs = records.map(
    (item) =>
      new Document({
        pageContent: item.summaryText,
        metadata: {
          userId: item.userId,
          documentId: item.documentId,
          chunkId: item.chunkId,
          title: item.title,
          chunkIndex: item.chunkIndex,
          keywords: item.keywords.join(' ')
        }
      })
  )
  await vectorStore.addVectors(
    records.map((item) => item.embedding),
    docs,
    {
      ids
    }
  )
}

function buildDocumentFilter(userId: string, documentId: string): Where {
  return {
    $and: [{ userId: { $eq: userId } }, { documentId: { $eq: documentId } }]
  }
}

function buildUserFilter(userId: string, documentIds?: string[]): Where {
  if (documentIds && documentIds.length > 0) {
    return {
      $and: [{ userId: { $eq: userId } }, { documentId: { $in: documentIds } }]
    }
  }
  return {
    userId: { $eq: userId }
  }
}

function parseScore(rawScore: number): number {
  if (!Number.isFinite(rawScore)) return 1
  return rawScore
}

function parseMetadata(meta: Record<string, unknown>): {
  userId: string
  documentId: string
  chunkId: string
  title: string
  chunkIndex: number
  keywords: string[]
} {
  const chunkIndexRaw = meta.chunkIndex
  const parsedChunkIndex =
    typeof chunkIndexRaw === 'number'
      ? chunkIndexRaw
      : Number.parseInt(String(chunkIndexRaw || 0), 10)
  const keywordsRaw = String(meta.keywords || '')
  return {
    userId: String(meta.userId || ''),
    documentId: String(meta.documentId || ''),
    chunkId: String(meta.chunkId || ''),
    title: String(meta.title || ''),
    chunkIndex: Number.isNaN(parsedChunkIndex) ? 0 : parsedChunkIndex,
    keywords: keywordsRaw
      .split(' ')
      .map((item) => item.trim())
      .filter(Boolean)
  }
}

function mapSearchRowToResult(input: {
  id: string
  score: number
  document: string
  metadata: Record<string, unknown>
}): RagSummarySearchResult | null {
  const meta = parseMetadata(input.metadata)
  if (!meta.documentId) return null
  return {
    summaryUuid: input.id,
    distance: parseScore(input.score),
    userId: meta.userId,
    documentId: meta.documentId,
    chunkId: meta.chunkId,
    title: meta.title,
    chunkIndex: meta.chunkIndex,
    keywords: meta.keywords,
    summaryText: input.document
  }
}

export async function deleteVectorsByDocumentIds(userId: string, documentIds: string[]): Promise<void> {
  if (documentIds.length === 0) return
  const vectorStore = await getVectorStore()
  for (const documentId of documentIds) {
    await vectorStore.delete({
      filter: buildDocumentFilter(userId, documentId)
    })
  }
}

export async function querySummaryVectors(input: {
  userId: string
  embeddings: number[][]
  topK: number
  documentIds?: string[]
}): Promise<RagSummarySearchResult[]> {
  if (input.embeddings.length === 0) return []
  const vectorStore = await getVectorStore()
  const where = buildUserFilter(input.userId, input.documentIds)
  const merged: RagSummarySearchResult[] = []
  for (const queryVector of input.embeddings) {
    const rows = await vectorStore.similaritySearchVectorWithScore(
      queryVector,
      Math.max(1, input.topK),
      where
    )
    for (const [document, score] of rows) {
      const item = mapSearchRowToResult({
        id: String(document.id || ''),
        score: Number(score),
        document: String(document.pageContent || ''),
        metadata: (document.metadata || {}) as Record<string, unknown>
      })
      if (item) {
        merged.push(item)
      }
    }
  }
  return merged
}
