<template>
  <div class="flex h-screen w-full bg-[var(--color-background)] overflow-hidden">
    <!-- 侧边栏 -->
    <div class="w-64 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col flex-shrink-0">
      <div class="p-4 border-b border-[var(--color-border)] space-y-3">
        <NuxtLink
          to="/"
          class="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>✨</span> 统一智能助手
        </NuxtLink>
        <NuxtLink
          to="/chat"
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>💬</span> AI 聊天
        </NuxtLink>
        <NuxtLink
          to="/rag"
          class="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>📚</span> RAG 知识库
        </NuxtLink>
        <NuxtLink
          to="/image"
          class="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>🎨</span> AI 图片生成
        </NuxtLink>
        <NuxtLink
          to="/virtual-list-demo"
          class="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <span>🚀</span> 虚拟列表演示
        </NuxtLink>
        <!-- 主题切换按钮 -->
        <div class="flex justify-center pt-2">
          <ThemeToggle />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-3 space-y-4">
        <div class="px-2 text-xs text-[var(--color-text-disabled)] font-medium">知识库说明</div>
        <div class="px-3 py-2 rounded-lg bg-[var(--color-hover)] text-xs text-[var(--color-text-secondary)] leading-relaxed space-y-2">
          <p>📤 支持上传 .md / .txt / .pdf</p>
          <p>🔍 自动分片与向量化</p>
          <p>🤖 基于上传文档进行问答</p>
        </div>
      </div>

      <!-- 用户信息区 -->
      <div class="p-4 border-t border-[var(--color-border)] flex-shrink-0">
        <div class="flex items-center gap-3">
          <label class="relative cursor-pointer group flex-shrink-0" title="点击更换头像">
            <div class="w-10 h-10 rounded-full overflow-hidden ring-2 ring-offset-1 ring-blue-200 group-hover:ring-blue-500 transition-all">
              <img v-if="userAvatar" :src="userAvatar" alt="头像" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold select-none">
                {{ authUser?.username?.[0]?.toUpperCase() || 'U' }}
              </div>
            </div>
            <div class="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" @change="onAvatarChange" />
          </label>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-[var(--color-text-primary)] truncate">{{ authUser?.username || '未登录' }}</p>
            <p v-if="uploadError" class="text-xs text-red-500 truncate">{{ uploadError }}</p>
            <p v-else-if="isUploadingAvatar" class="text-xs text-blue-500">上传中...</p>
            <p v-else class="text-xs text-[var(--color-text-disabled)]">{{ userAvatar ? '点击头像更换' : '点击头像上传' }}</p>
          </div>
          <button
            @click="logout"
            title="退出登录"
            class="flex-shrink-0 p-1.5 rounded-lg text-[var(--color-text-disabled)] hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 主区域 -->
    <div class="flex-1 overflow-y-auto bg-[var(--color-background)] p-6">
      <div class="mx-auto max-w-4xl space-y-4">
        <div class="flex items-center justify-between">
          <h1 class="text-xl font-semibold text-[var(--color-text-primary)]">知识库上传管理</h1>
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
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useApi } from '~/composables/useApi'
import { useAvatar } from '~/composables/useAvatar'
import { useAuth } from '~/composables/useAuth'

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
const { userAvatar, isUploading: isUploadingAvatar, uploadError, uploadAvatar } = useAvatar()
const { user: authUser, logout } = useAuth()

const onAvatarChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  await uploadAvatar(file)
  // 清空 input，允许重复选同一文件
  ;(e.target as HTMLInputElement).value = ''
}

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
      data?: { running: boolean; total: number; success: number; failed: number; message?: string }
    }
    if (!res.success) {
      throw new Error(res.message || '重建失败')
    }
    successMsg.value = res.message || '重建任务已启动'
    await pollReindexStatus()
  } catch (error) {
    errorMsg.value = `重建索引失败：${(error as Error).message}`
  } finally {
    reindexing.value = false
  }
}

async function pollReindexStatus(): Promise<void> {
  const maxPoll = 180
  for (let i = 0; i < maxPoll; i += 1) {
    const statusRes = (await api.get('/rag/documents/reindex-status')) as unknown as {
      success: boolean
      data: { running: boolean; total: number; success: number; failed: number; message?: string }
    }
    if (!statusRes.success) {
      break
    }
    const status = statusRes.data
    if (!status.running) {
      successMsg.value = `索引重建完成：总计 ${status.total}，成功 ${status.success}，失败 ${status.failed}`
      await loadDocuments()
      return
    }
    successMsg.value = `重建中：总计 ${status.total}，成功 ${status.success}，失败 ${status.failed}`
    await wait(2000)
  }
  successMsg.value = '重建任务仍在后台执行，请稍后刷新列表查看结果'
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
