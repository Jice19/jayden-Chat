/** 统一智能助手 API 的响应结构，前后端共用 */
export interface UnifiedResponse {
  intent: 'text' | 'image' | 'both'
  textReply: string
  imageUrl: string
  error: string
}

export type UnifiedBenchmarkMode = 'baseline' | 'optimized'

export interface UnifiedRequestMetric {
  requestId: number
  mode: UnifiedBenchmarkMode
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

export interface UnifiedGraphRuntimeStats {
  graphCompileCount: number
  llmCreateCount: number
}

export interface UnifiedMetricsData {
  performance: UnifiedPerformanceSummary
  runtime: UnifiedGraphRuntimeStats
}

export interface UnifiedMetricsResponse {
  code: number
  success: boolean
  message: string
  data: UnifiedMetricsData
}
