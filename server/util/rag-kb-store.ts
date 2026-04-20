import {
  appendFile,
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

function getUserRoot(userId: string): string {
  return resolve(process.cwd(), 'uploads', 'kb', userId)
}

function getDocsFilePath(userId: string): string {
  return join(getUserRoot(userId), 'documents.json')
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

export async function listRagDocuments(userId: string): Promise<RagStoredDocument[]> {
  await ensureUserDirs(userId)
  const docs = await readJsonFile<RagStoredDocument[]>(getDocsFilePath(userId), [])
  return docs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
}

export async function upsertRagDocument(userId: string, doc: RagStoredDocument): Promise<void> {
  await ensureUserDirs(userId)
  const docs = await readJsonFile<RagStoredDocument[]>(getDocsFilePath(userId), [])
  const index = docs.findIndex((item) => item.id === doc.id)
  if (index >= 0) {
    docs[index] = doc
  } else {
    docs.push(doc)
  }
  await writeJsonFile(getDocsFilePath(userId), docs)
}

export async function findRagDocumentByHash(
  userId: string,
  fileHash: string,
  fileSize: number
): Promise<RagStoredDocument | null> {
  const docs = await listRagDocuments(userId)
  const doc = docs.find((item) => item.fileHash === fileHash && item.size === fileSize)
  if (!doc) return null
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
