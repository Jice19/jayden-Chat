<template>
  <div class="min-h-screen bg-[var(--color-background)] p-6">
    <div class="mx-auto max-w-4xl space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold text-[var(--color-text-primary)]">知识库上传管理</h1>
        <NuxtLink
          to="/"
          class="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
        >
          返回聊天
        </NuxtLink>
      </div>

      <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <p class="text-sm text-[var(--color-text-secondary)]">
          当前支持格式：<span class="font-medium">.md / .txt / .pdf</span>，支持大文件分片上传（默认 5MB 分片，断点续传、秒传）。
        </p>

        <div class="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref="fileInputRef"
            type="file"
            accept=".md,.txt,.pdf"
            class="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-sm text-[var(--color-text-primary)]"
            @change="onFileChange"
          >
          <button
            class="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
            :disabled="!selectedFile || uploading"
            @click="uploadSelectedFile"
          >
            {{ uploading ? stageText : '上传文件' }}
          </button>
          <button
            class="rounded-md border border-[var(--color-border)] px-4 py-1.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] disabled:opacity-60"
            :disabled="loading"
            @click="loadDocuments"
          >
            刷新列表
          </button>
          <button
            class="rounded-md border border-[var(--color-border)] px-4 py-1.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] disabled:opacity-60"
            :disabled="reindexing"
            @click="reindexDocuments"
          >
            {{ reindexing ? '重建中...' : '重建索引' }}
          </button>
        </div>

        <p v-if="selectedFile" class="mt-2 text-xs text-[var(--color-text-secondary)]">
          已选择：{{ selectedFile.name }}（{{ formatBytes(selectedFile.size) }}）
        </p>
        <p v-if="hashProgress > 0 && hashProgress < 100" class="mt-1 text-xs text-[var(--color-text-secondary)]">
          哈希计算进度：{{ hashProgress }}%
        </p>
        <p v-if="uploadProgress > 0 && uploadProgress <= 100" class="mt-1 text-xs text-[var(--color-text-secondary)]">
          上传进度：{{ uploadProgress }}%
        </p>
        <p v-if="errorMsg" class="mt-2 text-xs text-red-500">{{ errorMsg }}</p>
        <p v-if="successMsg" class="mt-2 text-xs text-green-600">{{ successMsg }}</p>
      </div>

      <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 class="text-base font-medium text-[var(--color-text-primary)]">已上传文档</h2>

        <div v-if="loading" class="mt-3 text-sm text-[var(--color-text-secondary)]">加载中...</div>
        <div v-else-if="documents.length === 0" class="mt-3 text-sm text-[var(--color-text-secondary)]">
          暂无文档，先上传一个 `.md` 试试。
        </div>
        <div v-else class="mt-3 overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead>
              <tr class="border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
                <th class="px-2 py-2">文件名</th>
                <th class="px-2 py-2">索引状态</th>
                <th class="px-2 py-2">格式</th>
                <th class="px-2 py-2">大小</th>
                <th class="px-2 py-2">上传时间</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="doc in documents"
                :key="doc.id"
                class="border-b border-[var(--color-border)] text-[var(--color-text-primary)]"
              >
                <td class="px-2 py-2">{{ doc.originalName }}</td>
                <td class="px-2 py-2">{{ doc.indexStatus || 'PENDING' }}</td>
                <td class="px-2 py-2">{{ doc.ext || '-' }}</td>
                <td class="px-2 py-2">{{ formatBytes(doc.size) }}</td>
                <td class="px-2 py-2">{{ formatTime(doc.uploadedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 class="text-base font-medium text-[var(--color-text-primary)]">RAG 问答测试</h2>
        <div class="mt-3 space-y-3">
          <textarea
            v-model="question"
            rows="4"
            class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-sm text-[var(--color-text-primary)]"
            placeholder="输入问题，例如：请基于我上传的 Vue 笔记，总结 reactive 和 ref 的区别"
          />
          <div class="flex items-center gap-2">
            <select
              v-model="askMode"
              class="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-sm text-[var(--color-text-primary)]"
            >
              <option value="qa">问答</option>
              <option value="review">复盘</option>
              <option value="summary">总结</option>
            </select>
            <button
              class="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
              :disabled="asking || !question.trim()"
              @click="askRag"
            >
              {{ asking ? '生成中...' : '提问' }}
            </button>
          </div>

          <p v-if="askError" class="text-xs text-red-500">{{ askError }}</p>
          <div v-if="answer" class="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3">
            <p class="whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">{{ answer }}</p>
            <div v-if="references.length" class="mt-3 border-t border-[var(--color-border)] pt-2">
              <p class="text-xs text-[var(--color-text-secondary)]">引用来源：</p>
              <ul class="mt-1 space-y-1 text-xs text-[var(--color-text-secondary)]">
                <li v-for="(refItem, idx) in references" :key="`${refItem.documentId}-${idx}`">
                  [{{ idx + 1 }}] {{ refItem.title }}#{{ refItem.chunkIndex }} - {{ refItem.snippet }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useApi } from '~/composables/useApi'

interface RagDocumentItem {
  id: string
  originalName: string
  storedName: string
  size: number
  ext: string
  uploadedAt: string
  indexStatus?: 'PENDING' | 'READY' | 'FAILED'
  indexError?: string
}

interface RagDocumentsResponse {
  code: number
  success: boolean
  message: string
  data: RagDocumentItem[]
}

const api = useApi()
const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const documents = ref<RagDocumentItem[]>([])
const loading = ref(false)
const uploading = ref(false)
const asking = ref(false)
const reindexing = ref(false)
const hashProgress = ref(0)
const uploadProgress = ref(0)
const stageText = ref('上传中...')
const errorMsg = ref('')
const successMsg = ref('')
const question = ref('')
const askMode = ref<'qa' | 'review' | 'summary'>('qa')
const answer = ref('')
const askError = ref('')
const references = ref<Array<{ documentId: string; title: string; chunkIndex: number; snippet: string }>>([])

const CHUNK_SIZE = 5 * 1024 * 1024
const MAX_CONCURRENCY = 3

async function loadDocuments() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = (await api.get<RagDocumentsResponse>('/rag/documents')) as unknown as RagDocumentsResponse
    if (!res.success) {
      throw new Error(res.message || '获取文档列表失败')
    }
    documents.value = res.data
  } catch (error) {
    errorMsg.value = `加载文档失败：${(error as Error).message}`
  } finally {
    loading.value = false
  }
}

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement | null
  selectedFile.value = target?.files?.[0] ?? null
  errorMsg.value = ''
  successMsg.value = ''
}

async function uploadSelectedFile() {
  if (!selectedFile.value || uploading.value) return
  uploading.value = true
  hashProgress.value = 0
  uploadProgress.value = 0
  stageText.value = '计算哈希中...'
  errorMsg.value = ''
  successMsg.value = ''

  try {
    const file = selectedFile.value
    const fileHash = await computeFileHash(file)
    hashProgress.value = 100

    stageText.value = '初始化上传会话...'
    const initRes = (await api.post('/rag/uploads/init', {
      fileName: file.name,
      fileHash,
      fileSize: file.size,
      chunkSize: CHUNK_SIZE
    })) as unknown as {
      success: boolean
      message: string
      data: {
        shouldUpload: boolean
        uploadId: string
        uploadedChunkIndexes: number[]
        totalChunks: number
      }
    }
    if (!initRes.success) {
      throw new Error(initRes.message || '初始化上传失败')
    }

    if (!initRes.data.shouldUpload) {
      successMsg.value = '秒传成功（文件已存在）'
      selectedFile.value = null
      if (fileInputRef.value) fileInputRef.value.value = ''
      await loadDocuments()
      return
    }

    const uploadId = initRes.data.uploadId
    const uploadedSet = new Set<number>(initRes.data.uploadedChunkIndexes || [])
    const totalChunks = initRes.data.totalChunks || Math.ceil(file.size / CHUNK_SIZE)

    localStorage.setItem(getUploadStorageKey(fileHash), uploadId)

    stageText.value = '分片上传中...'
    uploadProgress.value = Number(((uploadedSet.size / totalChunks) * 100).toFixed(2))

    const missingIndexes: number[] = []
    for (let i = 0; i < totalChunks; i += 1) {
      if (!uploadedSet.has(i)) {
        missingIndexes.push(i)
      }
    }

    await runWithConcurrency(missingIndexes, MAX_CONCURRENCY, async (chunkIndex) => {
      const start = chunkIndex * CHUNK_SIZE
      const end = Math.min(file.size, start + CHUNK_SIZE)
      const chunk = file.slice(start, end)
      const chunkHash = await sha256Hex(await chunk.arrayBuffer())

      await uploadChunk(uploadId, chunkIndex, chunkHash, chunk)
      uploadedSet.add(chunkIndex)
      uploadProgress.value = Number(((uploadedSet.size / totalChunks) * 100).toFixed(2))
    })

    stageText.value = '服务端合并中...'
    const completeRes = (await api.post('/rag/uploads/complete', {
      uploadId,
      fileHash
    })) as unknown as { success: boolean; message: string }

    if (!completeRes.success) {
      throw new Error(completeRes.message || '文件合并失败')
    }

    localStorage.removeItem(getUploadStorageKey(fileHash))
    successMsg.value = '上传成功'
    selectedFile.value = null
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
    await loadDocuments()
  } catch (error) {
    errorMsg.value = `上传失败：${(error as Error).message}`
  } finally {
    uploading.value = false
    stageText.value = '上传中...'
  }
}

async function askRag() {
  if (!question.value.trim() || asking.value) return
  asking.value = true
  askError.value = ''
  answer.value = ''
  references.value = []
  try {
    const res = (await api.post('/rag/ask', {
      question: question.value.trim(),
      mode: askMode.value,
      topK: 5
    })) as unknown as {
      success: boolean
      message: string
      data: {
        answer: string
        references: Array<{ documentId: string; title: string; chunkIndex: number; snippet: string }>
      }
    }
    if (!res.success) {
      throw new Error(res.message || '提问失败')
    }
    answer.value = res.data.answer
    references.value = res.data.references || []
  } catch (error) {
    askError.value = `提问失败：${(error as Error).message}`
  } finally {
    asking.value = false
  }
}

async function reindexDocuments() {
  if (reindexing.value) return
  reindexing.value = true
  errorMsg.value = ''
  successMsg.value = ''
  try {
    const res = (await api.post('/rag/documents/reindex')) as unknown as {
      success: boolean
      message: string
      data?: { total: number; success: number; failed: number }
    }
    if (!res.success) {
      throw new Error(res.message || '重建失败')
    }
    const total = res.data?.total ?? 0
    const success = res.data?.success ?? 0
    const failed = res.data?.failed ?? 0
    successMsg.value = `索引重建完成：总计 ${total}，成功 ${success}，失败 ${failed}`
    await loadDocuments()
  } catch (error) {
    errorMsg.value = `重建索引失败：${(error as Error).message}`
  } finally {
    reindexing.value = false
  }
}

async function uploadChunk(
  uploadId: string,
  chunkIndex: number,
  chunkHash: string,
  chunkFile: Blob
): Promise<void> {
  const maxRetry = 3
  let attempt = 0
  while (attempt < maxRetry) {
    try {
      const formData = new FormData()
      formData.append('uploadId', uploadId)
      formData.append('chunkIndex', String(chunkIndex))
      formData.append('chunkHash', chunkHash)
      formData.append('chunkFile', chunkFile, `chunk-${chunkIndex}.part`)

      const res = (await api.put('/rag/uploads/chunk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })) as unknown as { success: boolean; message?: string }

      if (!res.success) {
        throw new Error(res.message || '分片上传失败')
      }
      return
    } catch (error) {
      attempt += 1
      if (attempt >= maxRetry) {
        throw error
      }
      await wait(300 * attempt)
    }
  }
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index]
      index += 1
      if (current !== undefined) {
        await worker(current)
      }
    }
  })
  await Promise.all(runners)
}

function computeFileHash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/file-hash.worker.ts', import.meta.url), {
      type: 'module'
    })

    worker.onmessage = (event: MessageEvent<{ type: string; progress?: number; hash?: string; message?: string }>) => {
      const payload = event.data
      if (payload.type === 'progress' && typeof payload.progress === 'number') {
        hashProgress.value = payload.progress
      }
      if (payload.type === 'done' && payload.hash) {
        worker.terminate()
        resolve(payload.hash)
      }
      if (payload.type === 'error') {
        worker.terminate()
        reject(new Error(payload.message || '计算 hash 失败'))
      }
    }

    worker.onerror = () => {
      worker.terminate()
      reject(new Error('WebWorker 执行失败'))
    }

    worker.postMessage({ file, chunkSize: CHUNK_SIZE })
  })
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const bytes = Array.from(new Uint8Array(digest))
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function getUploadStorageKey(fileHash: string): string {
  return `rag_upload_session_${fileHash}`
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size}B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`
  return `${(size / 1024 / 1024).toFixed(2)}MB`
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

onMounted(() => {
  loadDocuments()
})
</script>
