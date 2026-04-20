import { computed, ref } from 'vue'
import { useApi } from '~/composables/useApi'
import type {
  UnifiedBenchmarkMode,
  UnifiedMetricsData,
  UnifiedMetricsResponse
} from '~/../../types/unified'

const BENCHMARK_MODE_KEY = 'unified_benchmark_mode'

interface UnifiedMetricsResetResponse {
  code: number
  success: boolean
  message: string
  data: {
    resetSingletons: boolean
  }
}

export const useUnifiedPerformance = () => {
  const api = useApi()

  const benchmarkMode = ref<UnifiedBenchmarkMode>('optimized')
  const metrics = ref<UnifiedMetricsData | null>(null)
  const isMetricsLoading = ref(false)
  const isMetricsResetting = ref(false)
  const metricsError = ref('')
  const resetSingletons = ref(true)

  if (process.client) {
    const savedMode = localStorage.getItem(BENCHMARK_MODE_KEY)
    if (savedMode === 'baseline' || savedMode === 'optimized') {
      benchmarkMode.value = savedMode
    }
  }

  function setBenchmarkMode(mode: UnifiedBenchmarkMode) {
    benchmarkMode.value = mode
    if (process.client) {
      localStorage.setItem(BENCHMARK_MODE_KEY, mode)
    }
  }

  async function fetchMetrics() {
    isMetricsLoading.value = true
    metricsError.value = ''
    try {
      const res = (await api.get<UnifiedMetricsResponse>('/chat/unified-metrics')) as unknown as UnifiedMetricsResponse
      if (!res.success) {
        throw new Error(res.message || '获取性能统计失败')
      }
      metrics.value = res.data
    } catch (error) {
      metricsError.value = `获取统计失败：${(error as Error).message}`
    } finally {
      isMetricsLoading.value = false
    }
  }

  async function resetMetrics() {
    isMetricsResetting.value = true
    metricsError.value = ''
    try {
      const payload = { resetSingletons: resetSingletons.value }
      const res = (await api.post<UnifiedMetricsResetResponse>(
        '/chat/unified-metrics-reset',
        payload
      )) as unknown as UnifiedMetricsResetResponse
      if (!res.success) {
        throw new Error(res.message || '重置性能统计失败')
      }
      await fetchMetrics()
    } catch (error) {
      metricsError.value = `重置统计失败：${(error as Error).message}`
    } finally {
      isMetricsResetting.value = false
    }
  }

  const performanceReduction = computed<number | null>(() => {
    const baselineAvg = metrics.value?.performance.modeSummary.baseline.averageDurationMs ?? 0
    const optimizedAvg = metrics.value?.performance.modeSummary.optimized.averageDurationMs ?? 0
    if (baselineAvg <= 0 || optimizedAvg <= 0) {
      return null
    }
    const reduction = ((baselineAvg - optimizedAvg) / baselineAvg) * 100
    return Number(reduction.toFixed(2))
  })

  return {
    benchmarkMode,
    metrics,
    isMetricsLoading,
    isMetricsResetting,
    metricsError,
    resetSingletons,
    performanceReduction,
    setBenchmarkMode,
    fetchMetrics,
    resetMetrics
  }
}
