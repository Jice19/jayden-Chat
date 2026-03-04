/**
 * unified-graph.ts
 *
 * 用 LangGraph 构建一个"路由图"：
 *   1. router 节点 — 用 LLM 判断用户意图（文字 / 图片 / 两者都要）
 *   2. text 节点   — 调用 qwen-plus 生成文字回复
 *   3. image 节点  — 调用阿里云文生图 API
 *
 * 关键概念速查：
 *   State  = 贯穿整个图的共享数据（类似 Redux store）
 *   Node   = 接受 State、返回 Partial<State> 的纯函数
 *   Edge   = 节点间的跳转，可以是固定的也可以是条件判断的
 */

import { StateGraph, Annotation, END } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import { getApiKey } from './get-api-key'
import type { UnifiedResponse } from '../../types/unified'

// ─── 1. State 定义 ────────────────────────────────────────────────────────────

const GraphState = Annotation.Root({
  userMessage: Annotation<string>({ reducer: (_, b) => b }),
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

// ─── 2. 图编译单例（只在首次请求时编译，之后复用） ──────────────────────────

let _compiledGraph: ReturnType<typeof buildGraph> | null = null

function getCompiledGraph() {
  if (!_compiledGraph) {
    _compiledGraph = buildGraph()
  }
  return _compiledGraph
}

// ─── 3. 构建图（LLM 在此处创建，通过闭包传给各节点） ────────────────────────

function buildGraph() {
  // LLM 实例在图构建时创建一次，所有节点共用，避免重复初始化
  const llm = new ChatOpenAI({
    modelName: 'qwen-plus',
    openAIApiKey: getApiKey(),
    configuration: {
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    },
    temperature: 0.7,
    maxTokens: 2000
  })

  // router 节点：判断意图，提取图片提示词
  async function routerNode(state: UnifiedState): Promise<Partial<UnifiedState>> {
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

  // text 节点：调用 qwen-plus 生成文字回复
  async function textNode(state: UnifiedState): Promise<Partial<UnifiedState>> {
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

  // image 节点：调用阿里云文生图 API（非 OpenAI 兼容格式，直接用 $fetch）
  async function imageNode(state: UnifiedState): Promise<Partial<UnifiedState>> {
    const prompt = state.imagePrompt || state.userMessage
    try {
      const response = await $fetch<{
        output?: {
          choices?: Array<{
            message: { content: Array<{ image?: string }> }
          }>
        }
      }>('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          'Content-Type': 'application/json'
        },
        body: {
          model: 'qwen-image-2.0',
          input: { messages: [{ role: 'user', content: [{ text: prompt }] }] },
          parameters: { size: '1024*1024', prompt_extend: true, watermark: false }
        },
        timeout: 120000
      })

      const url = response.output?.choices?.[0]?.message?.content?.[0]?.image
      if (!url) throw new Error('API 未返回图片 URL')
      return { imageUrl: url }
    } catch (err) {
      return { error: `图片生成失败: ${(err as Error).message}` }
    }
  }

  // 条件路由函数
  function routeByIntent(state: UnifiedState): string {
    if (state.intent === 'image') return 'image'
    if (state.intent === 'both') return 'both'
    return 'text'
  }

  const graph = new StateGraph(GraphState)

  graph.addNode('router', routerNode)
  graph.addNode('text', textNode)
  graph.addNode('image', imageNode)

  graph.addEdge('__start__', 'router')

  graph.addConditionalEdges('router', routeByIntent, {
    text: 'text',
    image: 'image',
    both: 'text'   // both：先 text，text 结束后再触发 image
  })

  graph.addConditionalEdges('text', (state) => {
    return state.intent === 'both' ? 'image' : '__end__'
  }, {
    image: 'image',
    __end__: END
  })

  graph.addEdge('image', END)

  return graph.compile()
}

// ─── 4. 对外暴露的主函数 ──────────────────────────────────────────────────────

export async function runUnifiedGraph(
  userMessage: string,
  history: Array<{ role: string; content: string }> = []
): Promise<UnifiedResponse> {
  const app = getCompiledGraph()
  const result = await app.invoke({ userMessage, history })
  return {
    intent: result.intent,
    textReply: result.textReply,
    imageUrl: result.imageUrl,
    error: result.error
  }
}
