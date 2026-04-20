import { resetUnifiedGraphRuntimeStats } from '../../util/unified-graph'
import { resetUnifiedPerformanceSummary } from '../../util/unified-performance'

interface ResetBody {
  resetSingletons?: boolean
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ResetBody>(event).catch(() => ({} as ResetBody))
  const resetSingletons = Boolean(body.resetSingletons)

  resetUnifiedPerformanceSummary()
  resetUnifiedGraphRuntimeStats({ resetSingletons })

  return {
    code: 200,
    success: true,
    message: `重置 unified 统计成功${resetSingletons ? '（已清空单例）' : ''}`,
    data: {
      resetSingletons
    }
  }
})
