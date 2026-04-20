import { mkdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { extname, join, resolve } from 'node:path'

export const MAX_UPLOAD_SIZE = 20 * 1024 * 1024

const ALLOWED_EXTENSIONS = new Set(['.md', '.txt', '.pdf'])

export function getUserKbDir(userId: string): string {
  return resolve(process.cwd(), 'uploads', 'kb', userId)
}

export async function ensureUserKbDir(userId: string): Promise<string> {
  const dir = getUserKbDir(userId)
  await mkdir(dir, { recursive: true })
  return dir
}

export function normalizeExt(fileName: string): string {
  return extname(fileName).toLowerCase()
}

export function isAllowedFileType(fileName: string): boolean {
  const ext = normalizeExt(fileName)
  return ALLOWED_EXTENSIONS.has(ext)
}

export function sanitizeBaseName(fileName: string): string {
  const ext = normalizeExt(fileName)
  const base = fileName.slice(0, fileName.length - ext.length)
  const safe = base
    .replace(/[^\w\u4e00-\u9fa5.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
  return safe || 'document'
}

export function buildStoredFileName(originalName: string): string {
  const ext = normalizeExt(originalName)
  const safeBase = sanitizeBaseName(originalName)
  return `${Date.now()}-${randomUUID().slice(0, 8)}-${safeBase}${ext}`
}

export function buildStoredFilePath(userId: string, storedFileName: string): string {
  return join(getUserKbDir(userId), storedFileName)
}

export const RAG_ALLOWED_EXTENSIONS = [...ALLOWED_EXTENSIONS]
