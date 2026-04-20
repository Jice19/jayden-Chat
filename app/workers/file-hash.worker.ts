interface WorkerInput {
  file: File
  chunkSize: number
}

interface ProgressMessage {
  type: 'progress'
  progress: number
}

interface DoneMessage {
  type: 'done'
  hash: string
}

interface ErrorMessage {
  type: 'error'
  message: string
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

self.onmessage = async (event: MessageEvent<WorkerInput>) => {
  const { file, chunkSize } = event.data
  try {
    const partBuffers: Uint8Array[] = []
    let offset = 0

    while (offset < file.size) {
      const end = Math.min(offset + chunkSize, file.size)
      const part = file.slice(offset, end)
      const partBuffer = await part.arrayBuffer()
      partBuffers.push(new Uint8Array(partBuffer))
      offset = end
      const progress = Math.min(99, Math.floor((offset / file.size) * 100))
      const progressMessage: ProgressMessage = { type: 'progress', progress }
      self.postMessage(progressMessage)
    }

    const merged = new Uint8Array(file.size)
    let cursor = 0
    for (const part of partBuffers) {
      merged.set(part, cursor)
      cursor += part.length
    }

    const digest = await crypto.subtle.digest('SHA-256', merged.buffer)
    const doneMessage: DoneMessage = { type: 'done', hash: toHex(digest) }
    self.postMessage(doneMessage)
  } catch (error) {
    const message = error instanceof Error ? error.message : '计算文件哈希失败'
    const errorMessage: ErrorMessage = { type: 'error', message }
    self.postMessage(errorMessage)
  }
}
