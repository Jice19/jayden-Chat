export interface UnifiedRequestMetric {
  requestId: number
  mode: 'baseline' | 'optimized'
  durationMs: number
  startedAt: string
  endedAt: string
  messageLength: number
  historyLength: number
  intent?: 'text' | 'image' | 'both'
  success: boolean
  errorMessage?: string
}

export interface UnifiedPerformanceSummary {
  windowStartedAt: string
  totalRequests: number
  successRequests: number
  failedRequests: number
  averageDurationMs: number
  minDurationMs: number
  maxDurationMs: number
  p95DurationMs: number
  modeSummary: {
    baseline: {
      requestCount: number
      averageDurationMs: number
    }
    optimized: {
      requestCount: number
      averageDurationMs: number
    }
  }
  recentSamples: UnifiedRequestMetric[]
}

interface UnifiedMetricStore {
  windowStartedAt: number
  totalRequests: number
  successRequests: number
  failedRequests: number
  nextRequestId: number
  records: Array<{ durationMs: number; mode: 'baseline' | 'optimized' }>
  recentSamples: UnifiedRequestMetric[]
}

const MAX_RECENT_SAMPLES = 200

const store: UnifiedMetricStore = {
  windowStartedAt: Date.now(),
  totalRequests: 0,
  successRequests: 0,
  failedRequests: 0,
  nextRequestId: 1,
  records: [],
  recentSamples: []
}

function toRounded(n: number): number {
  return Number(n.toFixed(2))
}

function calcP95(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
  const value = sorted[index]
  return value ?? 0
}

export function startUnifiedRequestTimer(meta: {
  messageLength: number
  historyLength: number
  mode: 'baseline' | 'optimized'
}) {
  const startedAt = Date.now()
  const startedAtPerf = performance.now()
  const requestId = store.nextRequestId
  store.nextRequestId += 1

  return {
    requestId,
    end(result: {
      intent?: 'text' | 'image' | 'both'
      success: boolean
      errorMessage?: string
    }): number {
      const endedAtPerf = performance.now()
      const endedAt = Date.now()
      const durationMs = endedAtPerf - startedAtPerf

      store.totalRequests += 1
      if (result.success) {
        store.successRequests += 1
      } else {
        store.failedRequests += 1
      }
      store.records.push({ durationMs, mode: meta.mode })

      store.recentSamples.push({
        requestId,
        mode: meta.mode,
        durationMs: toRounded(durationMs),
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        messageLength: meta.messageLength,
        historyLength: meta.historyLength,
        intent: result.intent,
        success: result.success,
        errorMessage: result.errorMessage
      })
      if (store.recentSamples.length > MAX_RECENT_SAMPLES) {
        store.recentSamples.shift()
      }

      return toRounded(durationMs)
    }
  }
}

export function getUnifiedPerformanceSummary(): UnifiedPerformanceSummary {
  const durations = store.records.map((record) => record.durationMs)
  const total = durations.length
  const sum = durations.reduce((acc, n) => acc + n, 0)
  const avg = total > 0 ? sum / total : 0
  const min = total > 0 ? Math.min(...durations) : 0
  const max = total > 0 ? Math.max(...durations) : 0
  const p95 = calcP95(durations)
  const baselineDurations = store.records
    .filter((record) => record.mode === 'baseline')
    .map((record) => record.durationMs)
  const optimizedDurations = store.records
    .filter((record) => record.mode === 'optimized')
    .map((record) => record.durationMs)

  const baselineAverage = baselineDurations.length
    ? baselineDurations.reduce((acc, n) => acc + n, 0) / baselineDurations.length
    : 0
  const optimizedAverage = optimizedDurations.length
    ? optimizedDurations.reduce((acc, n) => acc + n, 0) / optimizedDurations.length
    : 0

  return {
    windowStartedAt: new Date(store.windowStartedAt).toISOString(),
    totalRequests: store.totalRequests,
    successRequests: store.successRequests,
    failedRequests: store.failedRequests,
    averageDurationMs: toRounded(avg),
    minDurationMs: toRounded(min),
    maxDurationMs: toRounded(max),
    p95DurationMs: toRounded(p95),
    modeSummary: {
      baseline: {
        requestCount: baselineDurations.length,
        averageDurationMs: toRounded(baselineAverage)
      },
      optimized: {
        requestCount: optimizedDurations.length,
        averageDurationMs: toRounded(optimizedAverage)
      }
    },
    recentSamples: [...store.recentSamples]
  }
}

export function resetUnifiedPerformanceSummary() {
  store.windowStartedAt = Date.now()
  store.totalRequests = 0
  store.successRequests = 0
  store.failedRequests = 0
  store.nextRequestId = 1
  store.records = []
  store.recentSamples = []
}
