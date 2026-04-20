import {
  appendFile,
  access,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

export interface RagStoredDocument {
  id: string
  originalName: string
  storedName: string
  fileHash: string
  size: number
  ext: string
  uploadedAt: string
  indexStatus?: 'PENDING' | 'READY' | 'FAILED'
  indexedAt?: string
  indexError?: string
}

export interface RagUploadSession {
  id: string
  userId: string
  fileName: string
  fileHash: string
  fileSize: number
  chunkSize: number
  totalChunks: number
  uploadedChunkIndexes: number[]
  status: 'INIT' | 'UPLOADING' | 'MERGING' | 'DONE' | 'FAILED'
  expiresAt: string
  createdAt: string
  updatedAt: string
  errorMessage?: string
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000
const prisma = (global as { prisma?: PrismaClient }).prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') {
  ;(global as { prisma?: PrismaClient }).prisma = prisma
}

let _ragDocumentsSchemaReady = false

function getUserRoot(userId: string): string {
  return resolve(process.cwd(), 'uploads', 'kb', userId)
}

function getDocsFilePath(userId: string): string {
  return join(getUserRoot(userId), 'documents.json')
}

function getLegacyMigratedFlagPath(userId: string): string {
  return join(getUserRoot(userId), '.documents.migrated')
}

function getSessionsDir(userId: string): string {
  return join(getUserRoot(userId), 'sessions')
}

function getSessionPath(userId: string, uploadId: string): string {
  return join(getSessionsDir(userId), `${uploadId}.json`)
}

export function getChunksDir(userId: string, uploadId: string): string {
  return join(getUserRoot(userId), 'chunks', uploadId)
}

export function getChunkPath(userId: string, uploadId: string, chunkIndex: number): string {
  return join(getChunksDir(userId, uploadId), `${chunkIndex}.part`)
}

function getFilesDir(userId: string): string {
  return join(getUserRoot(userId), 'files')
}

export function getTempMergedPath(userId: string, uploadId: string): string {
  return join(getUserRoot(userId), 'tmp', `${uploadId}.tmp`)
}

export function getFinalFilePath(userId: string, storedName: string): string {
  return join(getFilesDir(userId), storedName)
}

async function ensureUserDirs(userId: string): Promise<void> {
  await Promise.all([
    mkdir(getUserRoot(userId), { recursive: true }),
    mkdir(getSessionsDir(userId), { recursive: true }),
    mkdir(getFilesDir(userId), { recursive: true }),
    mkdir(join(getUserRoot(userId), 'chunks'), { recursive: true }),
    mkdir(join(getUserRoot(userId), 'tmp'), { recursive: true })
  ])
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8')
}

function rowToDocument(row: {
  id: string
  original_name: string
  stored_name: string
  file_hash: string
  size: number
  ext: string
  uploaded_at: Date | string
  index_status: string | null
  indexed_at: Date | string | null
  index_error: string | null
}): RagStoredDocument {
  return {
    id: row.id,
    originalName: row.original_name,
    storedName: row.stored_name,
    fileHash: row.file_hash,
    size: Number(row.size),
    ext: row.ext,
    uploadedAt:
      row.uploaded_at instanceof Date ? row.uploaded_at.toISOString() : String(row.uploaded_at),
    indexStatus: (row.index_status as RagStoredDocument['indexStatus']) || 'PENDING',
    indexedAt:
      row.indexed_at instanceof Date
        ? row.indexed_at.toISOString()
        : row.indexed_at
          ? String(row.indexed_at)
          : undefined,
    indexError: row.index_error || ''
  }
}

async function ensureRagDocumentsSchemaReady(): Promise<void> {
  if (_ragDocumentsSchemaReady) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rag_documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      size BIGINT NOT NULL,
      ext TEXT NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      index_status TEXT NOT NULL DEFAULT 'PENDING',
      indexed_at TIMESTAMPTZ NULL,
      index_error TEXT NOT NULL DEFAULT ''
    );
  `)
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_documents_user_hash_size ON rag_documents(user_id, file_hash, size);'
  )
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS idx_rag_documents_user_uploaded ON rag_documents(user_id, uploaded_at DESC);'
  )
  _ragDocumentsSchemaReady = true
}

async function migrateLegacyDocumentsIfNeeded(userId: string): Promise<void> {
  await ensureUserDirs(userId)
  const migratedFlagPath = getLegacyMigratedFlagPath(userId)
  const alreadyMigrated = await access(migratedFlagPath).then(() => true).catch(() => false)
  if (alreadyMigrated) return

  const legacyPath = getDocsFilePath(userId)
  const legacyDocs = await readJsonFile<RagStoredDocument[]>(legacyPath, [])
  if (legacyDocs.length > 0) {
    for (const doc of legacyDocs) {
      await upsertRagDocument(userId, doc)
    }
  }
  await writeFile(migratedFlagPath, new Date().toISOString(), 'utf-8')
}

export async function listRagDocuments(userId: string): Promise<RagStoredDocument[]> {
  await ensureRagDocumentsSchemaReady()
  await migrateLegacyDocumentsIfNeeded(userId)
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      original_name: string
      stored_name: string
      file_hash: string
      size: number
      ext: string
      uploaded_at: Date
      index_status: string | null
      indexed_at: Date | null
      index_error: string | null
    }>
  >(
    `
    SELECT id, original_name, stored_name, file_hash, size, ext, uploaded_at, index_status, indexed_at, index_error
    FROM rag_documents
    WHERE user_id = $1
    ORDER BY uploaded_at DESC
    `,
    userId
  )
  return rows.map(rowToDocument)
}

export async function upsertRagDocument(userId: string, doc: RagStoredDocument): Promise<void> {
  await ensureRagDocumentsSchemaReady()
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO rag_documents (
      id, user_id, original_name, stored_name, file_hash, size, ext, uploaded_at, index_status, indexed_at, index_error
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10::timestamptz, $11)
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      original_name = EXCLUDED.original_name,
      stored_name = EXCLUDED.stored_name,
      file_hash = EXCLUDED.file_hash,
      size = EXCLUDED.size,
      ext = EXCLUDED.ext,
      uploaded_at = EXCLUDED.uploaded_at,
      index_status = EXCLUDED.index_status,
      indexed_at = EXCLUDED.indexed_at,
      index_error = EXCLUDED.index_error
    `,
    doc.id,
    userId,
    doc.originalName,
    doc.storedName,
    doc.fileHash,
    doc.size,
    doc.ext,
    doc.uploadedAt,
    doc.indexStatus || 'PENDING',
    doc.indexedAt || null,
    doc.indexError || ''
  )
}

export async function findRagDocumentByHash(
  userId: string,
  fileHash: string,
  fileSize: number
): Promise<RagStoredDocument | null> {
  await ensureRagDocumentsSchemaReady()
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      original_name: string
      stored_name: string
      file_hash: string
      size: number
      ext: string
      uploaded_at: Date
      index_status: string | null
      indexed_at: Date | null
      index_error: string | null
    }>
  >(
    `
    SELECT id, original_name, stored_name, file_hash, size, ext, uploaded_at, index_status, indexed_at, index_error
    FROM rag_documents
    WHERE user_id = $1 AND file_hash = $2 AND size = $3
    ORDER BY uploaded_at DESC
    LIMIT 1
    `,
    userId,
    fileHash,
    fileSize
  )
  const doc = rows[0] ? rowToDocument(rows[0]) : null
  if (!doc) {
    await migrateLegacyDocumentsIfNeeded(userId)
    return null
  }
  const finalFilePath = getFinalFilePath(userId, doc.storedName)
  const exists = await stat(finalFilePath).then(() => true).catch(() => false)
  return exists ? doc : null
}

async function listSessionIds(userId: string): Promise<string[]> {
  await ensureUserDirs(userId)
  const names = await readdir(getSessionsDir(userId)).catch(() => [])
  return names.filter((name) => name.endsWith('.json')).map((name) => name.replace(/\.json$/, ''))
}

export async function findActiveSessionByHash(
  userId: string,
  fileHash: string,
  fileSize: number
): Promise<RagUploadSession | null> {
  const ids = await listSessionIds(userId)
  for (const id of ids) {
    const session = await getUploadSession(userId, id)
    if (!session) continue
    const notExpired = new Date(session.expiresAt).getTime() > Date.now()
    if (
      notExpired &&
      session.fileHash === fileHash &&
      session.fileSize === fileSize &&
      session.status !== 'DONE'
    ) {
      return session
    }
  }
  return null
}

export async function createUploadSession(input: {
  userId: string
  fileName: string
  fileHash: string
  fileSize: number
  chunkSize: number
  totalChunks: number
}): Promise<RagUploadSession> {
  await ensureUserDirs(input.userId)
  const now = new Date().toISOString()
  const session: RagUploadSession = {
    id: randomUUID(),
    userId: input.userId,
    fileName: input.fileName,
    fileHash: input.fileHash,
    fileSize: input.fileSize,
    chunkSize: input.chunkSize,
    totalChunks: input.totalChunks,
    uploadedChunkIndexes: [],
    status: 'INIT',
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    createdAt: now,
    updatedAt: now
  }
  await saveUploadSession(session)
  return session
}

export async function getUploadSession(
  userId: string,
  uploadId: string
): Promise<RagUploadSession | null> {
  await ensureUserDirs(userId)
  return readJsonFile<RagUploadSession | null>(getSessionPath(userId, uploadId), null)
}

export async function saveUploadSession(session: RagUploadSession): Promise<void> {
  await ensureUserDirs(session.userId)
  session.updatedAt = new Date().toISOString()
  await writeJsonFile(getSessionPath(session.userId, session.id), session)
}

export async function markChunkUploaded(
  userId: string,
  uploadId: string,
  chunkIndex: number
): Promise<RagUploadSession> {
  const session = await getUploadSession(userId, uploadId)
  if (!session) {
    throw new Error('上传会话不存在')
  }
  if (!session.uploadedChunkIndexes.includes(chunkIndex)) {
    session.uploadedChunkIndexes.push(chunkIndex)
    session.uploadedChunkIndexes.sort((a, b) => a - b)
  }
  session.status = 'UPLOADING'
  await saveUploadSession(session)
  return session
}

export async function mergeChunksToTempFile(session: RagUploadSession): Promise<string> {
  const tempFilePath = getTempMergedPath(session.userId, session.id)
  await rm(tempFilePath, { force: true }).catch(() => undefined)

  for (let i = 0; i < session.totalChunks; i += 1) {
    const chunkPath = getChunkPath(session.userId, session.id, i)
    const buffer = await readFile(chunkPath)
    await appendFile(tempFilePath, buffer)
  }

  return tempFilePath
}

export async function finalizeUpload(
  session: RagUploadSession,
  storedName: string,
  ext: string
): Promise<RagStoredDocument> {
  await ensureUserDirs(session.userId)
  const tempFilePath = getTempMergedPath(session.userId, session.id)
  const finalPath = getFinalFilePath(session.userId, storedName)
  await rename(tempFilePath, finalPath)

  const doc: RagStoredDocument = {
    id: storedName,
    originalName: session.fileName,
    storedName,
    fileHash: session.fileHash,
    size: session.fileSize,
    ext,
    uploadedAt: new Date().toISOString(),
    indexStatus: 'PENDING',
    indexError: ''
  }
  await upsertRagDocument(session.userId, doc)

  session.status = 'DONE'
  await saveUploadSession(session)
  return doc
}

export async function cleanupUploadChunks(userId: string, uploadId: string): Promise<void> {
  await rm(getChunksDir(userId, uploadId), { recursive: true, force: true }).catch(() => undefined)
}
