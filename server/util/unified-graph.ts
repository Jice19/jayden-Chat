/**
 * unified-graph.ts
 *
 * 用 LangGraph 构建一个"路由图"：
 *   1. router 节点 — 用 LLM 判断用户意图（文字 / 图片 / 两者都要）
 *   2. text 节点   — 调用 qwen-plus 生成文字回复
 *   3. image 节点  — 调用 qwen-image-2.0 生成图片
 *   4. merge 节点  — 把两路结果合并成统一响应
 *
 * 关键概念速查：
 *   State  = 贯穿整个图的共享数据（类似 Redux store）
 *   Node   = 接受 State、返回 Partial<State> 的纯函数
 *   Edge   = 节点间的跳转，可以是固定的也可以是条件判断的
 */

import { StateGraph, Annotation, END } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'

// ─── 1. 定义 State（图中所有节点共享） ───────────────────────────────────────

/**
 * Annotation.Root 定义状态结构。
 * 每个字段用 reducer 说明："当多个节点同时写这个字段时该怎么合并"
 *   - reducer: (a, b) => b  表示"后写的覆盖前写的"（最简单的策略）
 */
const GraphState = Annotation.Root({
  // 用户输入的原始消息
  userMessage: Annotation<string>({ reducer: (_, b) => b }),

  // router 判断出的意图：'text' | 'image' | 'both'
  intent: Annotation<'text' | 'image' | 'both'>({ reducer: (_, b) => b }),

  // 对话历史（用于文生文上下文）
  history: Annotation<Array<{ role: string; content: string }>>({
    reducer: (_, b) => b,
    default: () => []
  }),

  // 文生文的回复结果
  textReply: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),

  // 文生图生成的图片 URL
  imageUrl: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),

  // 文生图用的提示词（从 router 提取或直接用 userMessage）
  imagePrompt: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),

  // 最终错误信息
  error: Annotation<string>({ reducer: (_, b) => b, default: () => '' })
})

// 导出类型，方便其他文件引用
export type UnifiedState = typeof GraphState.State

// ─── 2. 创建与阿里云对话的 LLM 实例 ─────────────────────────────────────────

function createLLM() {
  const config = useRuntimeConfig()
  const apiKey = String(config.aliyunApiKey)
    .trim()
    .replace(/[""]/g, '"')
    .replace(/^"+|"+$/g, '')
    .replace(/[^\x20-\x7E]/g, '')

  // ChatOpenAI 配置指向阿里云兼容端点
  return new ChatOpenAI({
    modelName: 'qwen-plus',
    openAIApiKey: apiKey,
    configuration: {
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    },
    temperature: 0.7,
    maxTokens: 2000
  })
}

// ─── 3. 定义各个 Node ─────────────────────────────────────────────────────────

/**
 * router 节点
 * 作用：判断用户意图，决定需要走哪条路（文字、图片、还是两者都要）
 * 同时提取出图片生成用的提示词
 */
async function routerNode(state: UnifiedState): Promise<Partial<UnifiedState>> {
  const llm = createLLM()

  const systemPrompt = `你是一个意图分析助手。分析用户消息，用 JSON 格式返回：
{
  "intent": "text" | "image" | "both",
  "imagePrompt": "用于图片生成的提示词（英文效果更好），如果不需要生成图片则为空字符串",
  "textQuery": "用于文字回答的问题，如果不需要文字回答则为空字符串"
}

判断规则：
- 如果用户只要图片（含"生成"、"画"、"图片"等关键词并且没有追问文字）→ "image"
- 如果用户只要文字解答 → "text"
- 如果用户既要图片又要文字解释 → "both"
- 如果不确定，默认为 "text"

重要：只返回 JSON，不要有其他文字。`

  const response = await llm.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: state.userMessage }
  ])

  try {
    // 清理 LLM 返回的 markdown 代码块包裹（如有）
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
    // JSON 解析失败时降级为纯文字
    return { intent: 'text', imagePrompt: '' }
  }
}

/**
 * text 节点
 * 作用：调用 qwen-plus 生成文字回复，支持带历史上下文
 */
async function textNode(state: UnifiedState): Promise<Partial<UnifiedState>> {
  const llm = createLLM()

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: '你是一个乐于助人的 AI 助手。' },
    ...state.history,
    { role: 'user', content: state.userMessage }
  ]

  try {
    // invoke 返回完整回复（非流式，统一图暂时用非流式简化实现）
    const response = await llm.invoke(messages)
    return { textReply: response.content as string }
  } catch (err) {
    return { error: `文字生成失败: ${(err as Error).message}` }
  }
}

/**
 * image 节点
 * 作用：调用阿里云文生图 API，返回图片 URL
 * 注意：这里直接用 fetch 调阿里云旧版图片接口（它不兼容 OpenAI 格式）
 */
async function imageNode(state: UnifiedState): Promise<Partial<UnifiedState>> {
  const config = useRuntimeConfig()
  const apiKey = String(config.aliyunApiKey)
    .trim()
    .replace(/[""]/g, '"')
    .replace(/^"+|"+$/g, '')
    .replace(/[^\x20-\x7E]/g, '')

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
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: {
        model: 'qwen-image-2.0',
        input: {
          messages: [{ role: 'user', content: [{ text: prompt }] }]
        },
        parameters: {
          size: '1024*1024',
          prompt_extend: true,
          watermark: false
        }
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

// ─── 4. 定义路由函数（条件边） ────────────────────────────────────────────────

/**
 * 根据 router 节点判断的 intent，决定下一步走哪个节点
 * 返回的字符串必须对应 addConditionalEdges 中定义的映射 key
 */
function routeByIntent(state: UnifiedState): string {
  if (state.intent === 'text') return 'text'
  if (state.intent === 'image') return 'image'
  if (state.intent === 'both') return 'both' // 同时触发两个节点
  return 'text'
}

// ─── 5. 组装 LangGraph 图 ─────────────────────────────────────────────────────

/**
 * buildUnifiedGraph
 * 构建并编译图，返回可直接调用的 runnable
 *
 * 图结构：
 *   __start__ → router → (条件边) → text → __end__
 *                                 → image → __end__
 *                                 → text + image（并行）→ __end__
 */
export function buildUnifiedGraph() {
  const graph = new StateGraph(GraphState)

  // 注册节点
  graph.addNode('router', routerNode)
  graph.addNode('text', textNode)
  graph.addNode('image', imageNode)

  // 起点 → router
  graph.addEdge('__start__', 'router')

  // router → 条件路由
  graph.addConditionalEdges('router', routeByIntent, {
    text: 'text',     // intent="text"  → 走 text 节点
    image: 'image',   // intent="image" → 走 image 节点
    both: 'text'      // intent="both"  → 先走 text 节点（串行简化版，见注释）
    /**
     * 注意：LangGraph 支持真正的并行（Send API），但配置稍复杂。
     * 这里 "both" 先串行走 text，然后再走 image（通过下面的条件边实现）
     * 如果要真并行，可以用 Send(['text', 'image']) 替代
     */
  })

  // "both" 情况下，text 节点跑完再跑 image 节点
  // 判断：如果 intent 是 both，text 跑完后再触发 image
  graph.addConditionalEdges('text', (state) => {
    return state.intent === 'both' ? 'image' : '__end__'
  }, {
    image: 'image',
    __end__: END
  })

  // image 节点跑完 → 结束
  graph.addEdge('image', END)

  return graph.compile()
}

// ─── 6. 导出统一调用函数 ──────────────────────────────────────────────────────

/**
 * runUnifiedGraph
 * 对外暴露的主函数，API 路由调用这个
 *
 * @param userMessage 用户输入的文本
 * @param history 对话历史（用于文生文上下文记忆）
 * @returns { intent, textReply, imageUrl, error }
 */
export async function runUnifiedGraph(
  userMessage: string,
  history: Array<{ role: string; content: string }> = []
): Promise<{
  intent: 'text' | 'image' | 'both'
  textReply: string
  imageUrl: string
  error: string
}> {
  const app = buildUnifiedGraph()

  const result = await app.invoke({
    userMessage,
    history
  })

  return {
    intent: result.intent,
    textReply: result.textReply,
    imageUrl: result.imageUrl,
    error: result.error
  }
}
