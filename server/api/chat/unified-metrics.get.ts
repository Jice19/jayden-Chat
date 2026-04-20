import { getUnifiedGraphRuntimeStats } from '../../util/unified-graph'
import { getUnifiedPerformanceSummary } from '../../util/unified-performance'

export default defineEventHandler(() => {
  const performance = getUnifiedPerformanceSummary()
  const runtime = getUnifiedGraphRuntimeStats()

  return {
    code: 200,
    success: true,
    message: '获取 unified 性能统计成功',
    data: {
      performance,
      runtime
    }
  }
})
