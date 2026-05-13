import { StateGraph, Annotation, END } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import type { UnifiedResponse } from '../../types/unified'
import { getApiKey } from './get-api-key'

const IMAGE_KEYWORDS = [
  '生成图片', '生成图像', '生成一幅', '生成一张',
  '画一张', '画个', '帮我画', '画一幅',
  'create image', 'draw', '生成图', '画图', '来个头像', '画个图',
  '做张图', '做张图片', '生成个图', '生成一张图'
]
const TEXT_ONLY_KEYWORDS = [
  '什么是', '怎么做', '为什么', '告诉我', '分析', '比较',
  '区别', '推荐', '介绍', '讲解', '回答我', '解释一下',
  '含义是什么', '工作原理', '怎么用', '如何使用'
]
const BOTH_KEYWORDS = [
  '生成图片并解释', '生成图片并说明', '生成图片并描述',
  '生成图并解释', '生成图并说明', '生成图并描述',
  '画图并解释', '画图并说明', '画图并描述',
  '画个图并解释', '画个图并说明', '画个图并描述',
  '生成一张图并解释', '生成一张图并说明',
  '帮我画并解释', '帮我生成图片并解释',
  '生成图片并且说明', '生成图片而且解释',
  'generate image and explain', 'draw and explain',
  '生成图片然后解释', '生成图片再解释', '生成图片做解释',
  '并解释', '并说明', '并描述', '并且说明', '而且说明'
]

function quickClassifyIntent(message: string): { intent: UnifiedState['intent']; imagePrompt: string } | null {
  const msg = message.toLowerCase()
  if (BOTH_KEYWORDS.some((k) => msg.includes(k))) {
    const imagePart = extractImageSubject(message)
    return { intent: 'both', imagePrompt: imagePart }
  }
  if (IMAGE_KEYWORDS.some((k) => msg.includes(k))) {
    const hasTextOnly = TEXT_ONLY_KEYWORDS.some((k) => msg.includes(k))
    if (!hasTextOnly) {
      const imagePart = extractImageSubject(message)
      return { intent: 'image', imagePrompt: imagePart }
    }
  }
  return null
}

function extractImageSubject(message: string): string {
  const cleanMsg = message
    .replace(/并解释|并说明|并描述|并且说明|而且说明|并且解释|而且解释/g, '')
    .replace(/生成图片|生成图|生成一幅|生成一张|画一张|画个|帮我画|帮我生成|做个|做张/g, '')
    .trim()
  if (cleanMsg) return cleanMsg

  const patterns = [
    /生成[图片图幅张个](.+)/,
    /画[个张幅](.+)/,
    /帮我画(.+)/,
    /帮我生成(.+)/
  ]
  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match?.[1]) {
      const cleaned = match[1].replace(/并解释|并说明|并描述/g, '').trim()
      if (cleaned) return cleaned
    }
  }
  return message
}

function parseIntentResponse(raw: string): { intent: UnifiedState['intent']; imagePrompt: string } {
  const cleaned = raw
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .replace(/^[^{]+/, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned) as { intent?: string; imagePrompt?: string }
    const validIntents: UnifiedState['intent'][] = ['text', 'image', 'both']
    return {
      intent: validIntents.includes(parsed.intent as UnifiedState['intent']) ? (parsed.intent as UnifiedState['intent']) : 'text',
      imagePrompt: typeof parsed.imagePrompt === 'string' ? parsed.imagePrompt.trim() : ''
    }
  } catch {
    const intentMatch = raw.match(/"intent"\s*:\s*"([^"]+)"/)
    const promptMatch = raw.match(/"imagePrompt"\s*:\s*"([^"]+)"/)
    const capturedIntent = intentMatch?.[1] as UnifiedState['intent']
    return {
      intent: ['text', 'image', 'both'].includes(capturedIntent) ? capturedIntent : 'text',
      imagePrompt: promptMatch?.[1] || ''
    }
  }
}

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

function createLLM(temperature = 0.7, maxTokens = 2000) {
  return new ChatOpenAI({
    modelName: 'qwen3.6-plus',
    openAIApiKey: getApiKey(),
    configuration: {
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    },
    temperature,
    maxTokens
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

let _classifierLLMInstance: ChatOpenAI | null = null

function createClassifierLLM() {
  return new ChatOpenAI({
    modelName: 'qwen-plus',
    openAIApiKey: getApiKey(),
    configuration: {
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    },
    temperature: 0.1,
    maxTokens: 200
  })
}

function getClassifierLLM() {
  if (!_classifierLLMInstance) {
    _classifierLLMInstance = createClassifierLLM()
  }
  return _classifierLLMInstance
}

// ─── 3.5 意图分类缓存 ─────────────────────────────────────────────────────────

interface IntentCacheEntry {
  intent: UnifiedState['intent']
  imagePrompt: string
}

const _intentCache = new Map<string, IntentCacheEntry>()
const INTENT_CACHE_MAX_SIZE = 1000

function getIntentCacheKey(message: string): string {
  return message.toLowerCase().slice(0, 50)
}

function getCachedIntent(message: string): IntentCacheEntry | undefined {
  return _intentCache.get(getIntentCacheKey(message))
}

function setCachedIntent(message: string, entry: IntentCacheEntry): void {
  if (_intentCache.size >= INTENT_CACHE_MAX_SIZE) {
    const firstKey = _intentCache.keys().next().value
    if (firstKey) _intentCache.delete(firstKey)
  }
  _intentCache.set(getIntentCacheKey(message), entry)
}

// ─── 4. 节点函数 ──────────────────────────────────────────────────────────────

async function routerNode(state: UnifiedState): Promise<Partial<UnifiedState>> {
  const cached = getCachedIntent(state.userMessage)
  if (cached) {
    return {
      intent: cached.intent,
      imagePrompt: cached.imagePrompt || state.userMessage
    }
  }

  const quickResult = quickClassifyIntent(state.userMessage)
  if (quickResult) {
    const entry: IntentCacheEntry = { intent: quickResult.intent, imagePrompt: quickResult.imagePrompt }
    setCachedIntent(state.userMessage, entry)
    return {
      intent: quickResult.intent,
      imagePrompt: quickResult.imagePrompt || state.userMessage
    }
  }

  const llm = state.reuseLLM ? getClassifierLLM() : createClassifierLLM()

  const systemPrompt = `你是一个意图分析助手。根据用户消息返回 JSON 格式：
{"intent": "text" | "image" | "both", "imagePrompt": "英文图片生成提示词"}

示例：
- "画一只可爱的猫" → {"intent": "image", "imagePrompt": "a cute cat, cartoon style"}
- "什么是量子计算" → {"intent": "text", "imagePrompt": ""}
- "生成一个 logo 并解释含义" → {"intent": "both", "imagePrompt": "a modern minimalist logo design"}
- "帮我画个头像" → {"intent": "image", "imagePrompt": "a profile picture avatar"}
- "解释一下什么是机器学习" → {"intent": "text", "imagePrompt": ""}
- "画一个日出风景图" → {"intent": "image", "imagePrompt": "a sunrise landscape painting"}

判断规则：
- 明确要求生成/画/创建图片 → image
- 纯问答/解释/说明类请求 → text
- 同时要求图片和文字解释 → both
- 不确定时默认 → text

imagePrompt 使用英文，效果更好。

只返回 JSON，不要有其他文字。`

  try {
    const response = await llm.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: state.userMessage }
    ])

    const { intent, imagePrompt } = parseIntentResponse(response.content as string)
    const entry: IntentCacheEntry = { intent, imagePrompt }
    setCachedIntent(state.userMessage, entry)

    return {
      intent,
      imagePrompt: imagePrompt || state.userMessage
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
  const promptFromState = typeof state.imagePrompt === 'string' ? state.imagePrompt.trim() : ''
  const prompt = promptFromState || state.userMessage.trim()

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
      const errorBody = await response.text().catch(() => '')
      throw new Error(`API 返回错误: ${response.status}${errorBody ? ` - ${errorBody}` : ''}`)
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
