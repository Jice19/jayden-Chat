import { ingestDocumentToRag } from './rag-index'
import { listRagDocuments } from './rag-kb-store'

export interface RagReindexJobStatus {
  running: boolean
  total: number
  success: number
  failed: number
  startedAt: string
  endedAt?: string
  message?: string
}

const jobStore = new Map<string, RagReindexJobStatus>()

function createInitialStatus(): RagReindexJobStatus {
  return {
    running: true,
    total: 0,
    success: 0,
    failed: 0,
    startedAt: new Date().toISOString(),
    message: '重建任务已启动'
  }
}

export function getRagReindexStatus(userId: string): RagReindexJobStatus | null {
  return jobStore.get(userId) || null
}

export async function startRagReindexJob(userId: string): Promise<RagReindexJobStatus> {
  const existing = jobStore.get(userId)
  if (existing?.running) {
    return existing
  }

  const status = createInitialStatus()
  jobStore.set(userId, status)

  void (async () => {
    try {
      const docs = await listRagDocuments(userId)
      status.total = docs.length
      if (docs.length === 0) {
        status.running = false
        status.endedAt = new Date().toISOString()
        status.message = '暂无可重建文档'
        return
      }

      for (const doc of docs) {
        try {
          await ingestDocumentToRag(userId, doc)
          status.success += 1
        } catch {
          status.failed += 1
        }
      }
      status.running = false
      status.endedAt = new Date().toISOString()
      status.message = '重建完成'
    } catch (error) {
      status.running = false
      status.endedAt = new Date().toISOString()
      status.message = `重建失败：${(error as Error).message}`
    }
  })()

  return status
}
