import { StateGraph, Annotation, END } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import type { UnifiedResponse } from '../../types/unified'
import { getApiKey } from './get-api-key'

// ─── 1. 状态类型定义 ───────────────────────────────────────────────────────────

const GraphState = Annotation.Root({
  userMessage: Annotation<string>({ reducer: (_, b) => b }),
  reuseLLM: Annotation<boolean>({ reducer: (_, b) => b, default: () => true }),
  intent: Annotation<'text' | 'image' | 'both'>({ reducer: (_, b) => b }),
  history: Annotation<Array<{ role: string; content: string }>>({
    reducer: (_, b) => b,
    default: () => []
  }),
  textReply: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  imageUrl: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  imagePrompt: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  error: Annotation<string>({ reducer: (_, b) => b, default: () => '' })
})

export type UnifiedState = typeof GraphState.State

// ─── 2. 图编译单例（避免重复编译，提升性能） ─────────────────────────────────

let _compiledGraph: ReturnType<typeof buildGraph> | null = null
let _graphCompileCount = 0

function compileGraph() {
  _graphCompileCount += 1
  return buildGraph()
}

function getCompiledGraph() {
  if (!_compiledGraph) {
    _compiledGraph = compileGraph()
  }
  return _compiledGraph
}

// ─── 3. LLM 实例（闭包复用，只创建一次） ─────────────────────────────────────

function createLLM() {
  return new ChatOpenAI({
    modelName: 'qwen-plus',
    openAIApiKey: getApiKey(),
    configuration: {
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    },
    temperature: 0.7,
    maxTokens: 2000
  })
}

function createLLMInstance() {
  _llmCreateCount += 1
  return createLLM()
}

let _llmInstance: ChatOpenAI | null = null
let _llmCreateCount = 0

function getLLM() {
  if (!_llmInstance) {
    _llmInstance = createLLMInstance()
  }
  return _llmInstance
}

// ─── 4. 节点函数 ──────────────────────────────────────────────────────────────

async function routerNode(state: UnifiedState): Promise<Partial<UnifiedState>> {
  const llm = state.reuseLLM ? getLLM() : createLLMInstance()

  const systemPrompt = `你是一个意图分析助手。分析用户消息，用 JSON 格式返回：
{
  "intent": "text" | "image" | "both",
  "imagePrompt": "用于图片生成的提示词（英文效果更好），如果不需要生成图片则为空字符串"
}

判断规则：
- 只要图片（含"生成"、"画"、"图片"等关键词且没有追问）→ "image"
- 只要文字解答 → "text"
- 既要图片又要文字解释 → "both"
- 不确定时默认 → "text"

只返回 JSON，不要有其他文字。`

  const response = await llm.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: state.userMessage }
  ])

  try {
    const raw = (response.content as string)
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    const parsed = JSON.parse(raw)
    return {
      intent: parsed.intent ?? 'text',
      imagePrompt: parsed.imagePrompt ?? state.userMessage
    }
  } catch {
    return { intent: 'text', imagePrompt: '' }
  }
}

async function textNode(state: UnifiedState): Promise<Partial<UnifiedState>> {
  const llm = state.reuseLLM ? getLLM() : createLLMInstance()

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: '你是一个乐于助人的 AI 助手。' },
    ...state.history,
    { role: 'user', content: state.userMessage }
  ]

  try {
    const response = await llm.invoke(messages)
    return { textReply: response.content as string }
  } catch (err) {
    return { error: `文字生成失败: ${(err as Error).message}` }
  }
}

async function imageNode(state: UnifiedState): Promise<Partial<UnifiedState>> {
  const prompt = state.imagePrompt || state.userMessage

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)

    const response = await fetch(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'qwen-image-2.0',
          input: { messages: [{ role: 'user', content: [{ text: prompt }] }] },
          parameters: { size: '1024*1024', prompt_extend: true, watermark: false }
        }),
        signal: controller.signal
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`API 返回错误: ${response.status}`)
    }

    const data = await response.json() as {
      output?: {
        choices?: Array<{ message: { content: Array<{ image?: string }> } }>
      }
    }

    const url = data.output?.choices?.[0]?.message?.content?.[0]?.image
    if (!url) throw new Error('API 未返回图片 URL')

    return { imageUrl: url }
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误'
    return { error: `图片生成失败: ${message}` }
  }
}

// ─── 5. 条件路由函数（使用 if 判断，逻辑清晰） ───────────────────────────────

function routeFromRouter(state: UnifiedState): string {
  const intent = state.intent
  if (intent === 'image') return 'image'
  if (intent === 'both') return 'text'
  return 'text'
}

function routeFromText(state: UnifiedState): string {
  if (state.intent === 'both') return 'image'
  return '__end__'
}

// ─── 6. 构建图 ────────────────────────────────────────────────────────────────

function buildGraph() {
  const graph = new StateGraph(GraphState)
    .addNode('router', routerNode)
    .addNode('text', textNode)
    .addNode('image', imageNode)
    .addEdge('__start__', 'router')
    .addConditionalEdges('router', routeFromRouter, {
      text: 'text',
      image: 'image'
    })
    .addConditionalEdges('text', routeFromText, {
      image: 'image',
      __end__: END
    })
    .addEdge('image', END)

  return graph.compile()
}

// ─── 7. 对外暴露的主函数 ──────────────────────────────────────────────────────

export async function runUnifiedGraph(
  userMessage: string,
  history: Array<{ role: string; content: string }> = [],
  options?: {
    reuseCompiledGraph?: boolean
    reuseLLM?: boolean
  }
): Promise<UnifiedResponse> {
  const reuseCompiledGraph = options?.reuseCompiledGraph ?? true
  const reuseLLM = options?.reuseLLM ?? true
  const app = reuseCompiledGraph ? getCompiledGraph() : compileGraph()
  const result = await app.invoke({ userMessage, history, reuseLLM })
  return {
    intent: result.intent,
    textReply: result.textReply,
    imageUrl: result.imageUrl,
    error: result.error
  }
}

export interface UnifiedGraphRuntimeStats {
  graphCompileCount: number
  llmCreateCount: number
}

export function getUnifiedGraphRuntimeStats(): UnifiedGraphRuntimeStats {
  return {
    graphCompileCount: _graphCompileCount,
    llmCreateCount: _llmCreateCount
  }
}

export function resetUnifiedGraphRuntimeStats(options?: { resetSingletons?: boolean }) {
  _graphCompileCount = 0
  _llmCreateCount = 0

  if (options?.resetSingletons) {
    _compiledGraph = null
    _llmInstance = null
  }
}
