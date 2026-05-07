import { ChatOpenAI } from '@langchain/openai'
import {
  buildRagContext,
  getIndexedDocumentIds,
  ingestDocumentToRag,
  runRagPipeline,
  searchRagChunks
} from '../../util/rag-index'
import { getApiKey } from '../../util/get-api-key'
import { listRagDocuments } from '../../util/rag-kb-store'

interface AskBody {
  question: string
  mode?: 'qa' | 'review' | 'summary'
  topK?: number
  recallTopK?: number
  rerankTopN?: number
  queryExpansionCount?: number
  documentIds?: string[]
  debug?: boolean
}

let _ragLlm: ChatOpenAI | null = null

function getRagLlm(): ChatOpenAI {
  if (_ragLlm) return _ragLlm
  _ragLlm = new ChatOpenAI({
    modelName: 'qwen3.6-plus',
    openAIApiKey: getApiKey(),
    configuration: {
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    },
    temperature: 0.2,
    maxTokens: 1800
  })
  return _ragLlm
}

function buildModeInstruction(mode: 'qa' | 'review' | 'summary'): string {
  if (mode === 'review') {
    return '你是面试复盘助手。请基于知识库内容输出：回答亮点、问题缺口、改进建议、可能追问。'
  }
  if (mode === 'summary') {
    return '你是知识总结助手。请按“定义、原理、适用场景、易错点、面试表达”结构化输出。'
  }
  return '你是知识库问答助手。请直接回答问题，并在末尾给出关键依据点。'
}

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.sub as string | undefined
  if (!userId) {
    throw createError({ statusCode: 401, message: '未登录，请先登录' })
  }

  const body = await readBody<AskBody>(event)
  const question = String(body.question || '').trim()
  const mode = body.mode || 'qa'
  const topK = Math.max(1, Math.min(10, Number(body.topK || body.rerankTopN || 5)))
  const recallTopK = Math.max(1, Math.min(50, Number(body.recallTopK || 20)))
  const rerankTopN = Math.max(1, Math.min(10, Number(body.rerankTopN || topK || 5)))
  const queryExpansionCount = Math.max(1, Math.min(5, Number(body.queryExpansionCount || 3)))
  const debug = Boolean(body.debug)
  const documentIds = Array.isArray(body.documentIds) ? body.documentIds : undefined

  if (!question) {
    throw createError({ statusCode: 400, message: '问题不能为空' })
  }

  let retrieved = await searchRagChunks({
    userId,
    question,
    topK,
    documentIds
  })

  if (retrieved.length === 0) {
    const docs = await listRagDocuments(userId)
    const candidates = docs.filter((doc) => doc.ext === 'md' || doc.ext === 'txt')
    if (candidates.length > 0) {
      const indexedIds = await getIndexedDocumentIds(userId)
      for (const doc of candidates) {
        if (indexedIds.has(doc.id)) continue
        try {
          await ingestDocumentToRag(userId, doc)
        } catch {
          // 忽略单文档失败，继续其它文档
        }
      }
      retrieved = await searchRagChunks({
        userId,
        question,
        topK,
        documentIds
      })
    }
  }

  if (retrieved.length === 0) {
    return {
      code: 200,
      success: true,
      message: '未检索到相关知识片段',
      data: {
        answer: '我在你的知识库里没有检索到直接相关内容。可以换个问法，或先上传相关笔记（推荐 .md/.txt）。',
        references: [],
        usedChunks: 0
      }
    }
  }

  const pipeline = await runRagPipeline({
    userId,
    question,
    recallTopK,
    rerankTopN,
    queryExpansionCount,
    documentIds
  })
  const finalChunks = pipeline.chunks.length > 0 ? pipeline.chunks : retrieved.slice(0, rerankTopN)
  const context = buildRagContext(finalChunks)
  const systemPrompt = [
    '你是一个严格基于知识库回答的助手。',
    buildModeInstruction(mode),
    '如果知识库未覆盖，请明确说明，不要编造。',
    '回答要用中文，简洁清晰。'
  ].join('\n')

  const llm = getRagLlm()
  const response = await llm.invoke([
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `问题：${question}\n\n知识库上下文：\n${context}\n\n请基于以上内容作答。`
    }
  ])

  const references = finalChunks.map((item) => ({
    documentId: item.documentId,
    title: item.title,
    chunkIndex: item.chunkIndex,
    snippet: item.content.slice(0, 180)
  }))

  return {
    code: 200,
    success: true,
    message: '回答成功',
    data: {
      answer: String(response.content || ''),
      references,
      usedChunks: finalChunks.length,
      ...(debug
        ? {
            debugTrace: {
              ...pipeline.debugTrace,
              retrievedSummaries: pipeline.debugTrace.recallCandidates,
              rerankedChunks: pipeline.debugTrace.finalContext
            }
          }
        : {})
    }
  }
})
