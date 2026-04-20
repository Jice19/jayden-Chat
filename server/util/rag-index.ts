import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { RagStoredDocument } from './rag-kb-store'
import { getFinalFilePath, upsertRagDocument } from './rag-kb-store'

export interface RagChunkRecord {
  id: string
  userId: string
  documentId: string
  title: string
  chunkIndex: number
  content: string
  createdAt: string
}

interface RagChunksFile {
  version: 1
  chunks: RagChunkRecord[]
}

function getChunksFilePath(userId: string): string {
  return resolve(process.cwd(), 'uploads', 'kb', userId, 'chunks.index.json')
}

async function readChunksFile(userId: string): Promise<RagChunksFile> {
  const path = getChunksFilePath(userId)
  try {
    const raw = await readFile(path, 'utf-8')
    return JSON.parse(raw) as RagChunksFile
  } catch {
    return { version: 1, chunks: [] }
  }
}

export async function getIndexedDocumentIds(userId: string): Promise<Set<string>> {
  const file = await readChunksFile(userId)
  return new Set(file.chunks.map((chunk) => chunk.documentId))
}

async function writeChunksFile(userId: string, value: RagChunksFile): Promise<void> {
  const path = getChunksFilePath(userId)
  await writeFile(path, JSON.stringify(value, null, 2), 'utf-8')
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
  const lower = text.toLowerCase()
  return lower
    .split(/[^a-z0-9\u4e00-\u9fa5]+/g)
    .map((token) => token.trim())
    .filter(Boolean)
}

function scoreChunk(question: string, chunk: string, title?: string): number {
  const qTokens = tokenize(question)
  const cTokens = tokenize(chunk)
  if (qTokens.length === 0 || cTokens.length === 0) return 0

  const counts = new Map<string, number>()
  for (const token of cTokens) {
    counts.set(token, (counts.get(token) || 0) + 1)
  }

  let score = 0
  for (const token of qTokens) {
    score += counts.get(token) || 0
  }

  const joinedChunk = chunk.toLowerCase()
  if (joinedChunk.includes(question.toLowerCase())) {
    score += 5
  }

  if (title) {
    const joinedTitle = title.toLowerCase()
    for (const token of qTokens) {
      if (joinedTitle.includes(token)) {
        score += 3
      }
    }
  }

  if (/面试|面经/.test(question) && title && /面试|面经/.test(title)) {
    score += 8
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

export async function ingestDocumentToRag(userId: string, document: RagStoredDocument): Promise<number> {
  try {
    const rawText = await readSupportedTextDocument(userId, document)
    const chunks = splitTextToChunks(rawText)

    const chunksFile = await readChunksFile(userId)
    const filtered = chunksFile.chunks.filter((item) => item.documentId !== document.id)
    const now = new Date().toISOString()
    const merged = [
      ...filtered,
      ...chunks.map((content, index) => ({
        id: `${document.id}::${index}`,
        userId,
        documentId: document.id,
        title: document.originalName,
        chunkIndex: index,
        content,
        createdAt: now
      }))
    ]

    await writeChunksFile(userId, { version: 1, chunks: merged })
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
  const file = await readChunksFile(input.userId)
  const filtered = input.documentIds?.length
    ? file.chunks.filter((item) => input.documentIds?.includes(item.documentId))
    : file.chunks

  const scored = filtered
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(input.question, chunk.content, chunk.title)
    }))
    .sort((a, b) => b.score - a.score)

  const positive = selectDiverseChunks(
    scored.filter((item) => item.score > 0),
    input.topK
  )
  if (positive.length > 0) {
    return positive
  }

  // 兜底：如果没有明显关键词命中，返回前 topK 个片段，避免“总是无结果”
  return selectDiverseChunks(scored, input.topK)
}

export function buildRagContext(chunks: Array<RagChunkRecord & { score: number }>): string {
  return chunks
    .map((chunk, index) => `[${index + 1}] ${chunk.title}#${chunk.chunkIndex}\n${chunk.content}`)
    .join('\n\n')
}
