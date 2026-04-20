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
          当前支持格式：<span class="font-medium">.md / .txt / .pdf</span>，单文件最大 20MB。
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
            {{ uploading ? '上传中...' : '上传文件' }}
          </button>
          <button
            class="rounded-md border border-[var(--color-border)] px-4 py-1.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] disabled:opacity-60"
            :disabled="loading"
            @click="loadDocuments"
          >
            刷新列表
          </button>
        </div>

        <p v-if="selectedFile" class="mt-2 text-xs text-[var(--color-text-secondary)]">
          已选择：{{ selectedFile.name }}（{{ formatBytes(selectedFile.size) }}）
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
                <td class="px-2 py-2">{{ doc.ext || '-' }}</td>
                <td class="px-2 py-2">{{ formatBytes(doc.size) }}</td>
                <td class="px-2 py-2">{{ formatTime(doc.uploadedAt) }}</td>
              </tr>
            </tbody>
          </table>
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
const errorMsg = ref('')
const successMsg = ref('')

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
  errorMsg.value = ''
  successMsg.value = ''

  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)

    const res = (await api.post('/rag/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })) as unknown as { success: boolean; message: string }

    if (!res.success) {
      throw new Error(res.message || '上传失败')
    }

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
  }
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
