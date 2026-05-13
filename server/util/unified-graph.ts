import { StateGraph, Annotation, END } from '@langchain/langgraph'
import type { UnifiedResponse } from '../../types/unified'
import { skills } from '../skills/registry'
import { executeSkill } from '../skills/executor'
import { getLLM } from './llm-manager'

const GraphState = Annotation.Root({
  userMessage: Annotation<string>({ reducer: (_, b) => b }),
  history: Annotation<Array<{ role: string; content: string }>>({
    reducer: (_, b) => b,
    default: () => []
  }),
  intent: Annotation<'text' | 'image' | 'both' | 'unknown'>({
    reducer: (_, b) => b,
    default: () => 'unknown'
  }),
  textReply: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  imageUrl: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  imagePrompt: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  error: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  agentOutput: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  executionLog: Annotation<Array<{ step: number; thought: string; action?: string; observation?: string }>>({
    reducer: (a, b) => [...a, ...b],
    default: () => []
  })
})

export type UnifiedState = typeof GraphState.State

const MAX_REACT_STEPS = 5

const SYSTEM_PROMPT = `你是一个智能助手，基于 ReAct (Reasoning + Acting) 模式工作。

## 可用工具

1. **text_generation** - 用于：
   - 回答用户问题
   - 解释概念、原理
   - 对话交流
   - 分析、比较、推荐
   - 当用户只想要文字回复时

2. **image_generation** - 用于：
   - 生成图片、画图
   - 创建头像、插画
   - 制作 logo、海报
   - 当用户明确要求生成/画/创建图片时

3. **final_response** - 用于：
   - 当你已经获取了所有需要的信息
   - 需要向用户返回最终结果时
   - 调用此工具结束对话

## 输出格式

每一步必须输出 JSON 格式的思考和行动：

\`\`\`json
{
  "thought": "你的思考过程，解释你为什么选择这个行动",
  "action": "工具名称 (text_generation | image_generation | final_response)",
  "action_input": {
    // 对于 text_generation: {"textReply": "你的回答内容"}
    // 对于 image_generation: {"imagePrompt": "图片描述"}
    // 对于 final_response: {"textReply": "最终回复", "imageUrl": "可选的图片URL"}
  }
}
\`\`\`

## 决策规则

- 如果用户问题需要专业知识但你不确定 → 先用 text_generation 获取信息
- 如果用户要求生成图片 → 直接用 image_generation
- 如果用户要求"生成图片并解释" → 先 image_generation，再 text_generation（回复中引用图片）
- 如果用户只是聊天问答 → 用 text_generation
- 如果已经获得所有需要的信息 → 用 final_response 结束

## 示例

用户: "画一只可爱的猫"
\`\`\`json
{
  "thought": "用户明确要求生成一张猫的图片，包含'画'和'猫'关键词，应该使用图片生成工具",
  "action": "image_generation",
  "action_input": {"imagePrompt": "a cute cat, cartoon style"}
}
\`\`\`

用户: "什么是量子计算"
\`\`\`json
{
  "thought": "用户问的是一个概念性问题，需要用文字解释，应该使用文本生成工具",
  "action": "text_generation",
  "action_input": {}
}
\`\`\`

用户: "帮我画个 logo 并解释含义"
\`\`\`json
{
  "thought": "用户同时需要图片和解释，应该先用图片生成工具获取 logo",
  "action": "image_generation",
  "action_input": {"imagePrompt": "a modern minimalist logo design"}
}
\`\`\`

## 重要提醒

1. 每次只选择一个行动
2. 如果是 text_generation 或 image_generation，你会收到工具执行结果，然后继续思考下一步
3. 只有当所有信息都准备好后，才使用 final_response
4. 最多执行 5 步，如果还没完成，强制使用 final_response 返回已有结果`

interface ReActOutput {
  thought: string
  action: 'text_generation' | 'image_generation' | 'final_response'
  action_input: {
    textReply?: string
    imagePrompt?: string
    imageUrl?: string
  }
}

function parseReActOutput(raw: string): ReActOutput | null {
  const cleaned = raw
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .replace(/^[^{]+/, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned) as ReActOutput
    if (parsed.action && ['text_generation', 'image_generation', 'final_response'].includes(parsed.action)) {
      return parsed
    }
  } catch {
    const thoughtMatch = raw.match(/"thought"\s*:\s*"([^"]+)"/)
    const actionMatch = raw.match(/"action"\s*:\s*"([^"]+)"/)

    if (actionMatch?.[1] && ['text_generation', 'image_generation', 'final_response'].includes(actionMatch[1])) {
      return {
        thought: thoughtMatch?.[1] || '用户请求',
        action: actionMatch[1] as ReActOutput['action'],
        action_input: {}
      }
    }

    const lowerRaw = raw.toLowerCase()
    if (lowerRaw.includes('生成图片') || lowerRaw.includes('画') || lowerRaw.includes('image')) {
      return { thought: '解析失败，基于关键词判断为图片生成请求', action: 'image_generation', action_input: {} }
    }
    if (lowerRaw.includes('final') || lowerRaw.includes('结束') || lowerRaw.includes('返回结果')) {
      return { thought: '解析失败，基于关键词判断为结束请求', action: 'final_response', action_input: {} }
    }
  }
  return null
}

function safeFallbackParse(raw: string): ReActOutput {
  return {
    thought: `无法解析 LLM 输出，当作文字生成处理: ${raw.slice(0, 50)}`,
    action: 'text_generation',
    action_input: {}
  }
}

async function reasonNode(state: UnifiedState): Promise<Partial<UnifiedState>> {
  const llm = getLLM()

  const historyText = state.history.length > 0
    ? `\n\n对话历史:\n${state.history.map(h => `${h.role}: ${h.content}`).join('\n')}`
    : ''

  const currentInfo: string[] = []
  if (state.imageUrl) {
    currentInfo.push(`- 已生成图片: ${state.imageUrl}`)
  }
  if (state.textReply) {
    currentInfo.push(`- 已生成文字回复: ${state.textReply.slice(0, 50)}...`)
  }
  const currentInfoText = currentInfo.length > 0
    ? `\n\n当前已获取的信息:\n${currentInfo.join('\n')}`
    : ''

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `用户消息: ${state.userMessage}${historyText}${currentInfoText}` }
  ]

  if (state.executionLog.length > 0) {
    const logText = state.executionLog.map(entry => {
      let text = `步骤 ${entry.step}: ${entry.thought}`
      if (entry.action) text += `\n行动: ${entry.action}`
      if (entry.observation) text += `\n结果: ${entry.observation}`
      return text
    }).join('\n\n')
    messages.push({ role: 'system', content: `\n\n执行记录:\n${logText}\n\n请根据以上记录继续思考下一步行动。` })
  }

  try {
    const response = await llm.invoke(messages)
    const output = response.content as string

    const parsed = parseReActOutput(output) || safeFallbackParse(output)

    return {
      agentOutput: JSON.stringify(parsed),
      executionLog: [{
        step: state.executionLog.length + 1,
        thought: parsed.thought,
        action: parsed.action,
        observation: ''
      }]
    }
  } catch (err) {
    return { error: `推理失败: ${(err as Error).message}` }
  }
}

async function actNode(state: UnifiedState): Promise<Partial<UnifiedState>> {
  const parsed = parseReActOutput(state.agentOutput) || safeFallbackParse(state.agentOutput)

  switch (parsed.action) {
    case 'text_generation': {
      const result = await executeSkill('text', {
        userMessage: state.userMessage,
        history: state.history,
        imageUrl: state.imageUrl
      })
      if (result.success && result.data) {
        const newLog = [...state.executionLog]
        newLog[newLog.length - 1].observation = `生成的文字回复: ${(result.data.textReply || '').slice(0, 50)}...`
        return {
          textReply: result.data.textReply || '',
          intent: state.imageUrl ? 'both' : 'text',
          executionLog: newLog
        }
      }
      return { error: result.error || '文本生成失败' }
    }

    case 'image_generation': {
      const imagePrompt = parsed.action_input.imagePrompt || state.userMessage
      const result = await executeSkill('image', { userMessage: state.userMessage, imagePrompt })
      if (result.success && result.data) {
        const newLog = [...state.executionLog]
        newLog[newLog.length - 1].observation = `生成的图片: ${result.data.imageUrl || '成功'}`
        return {
          imageUrl: result.data.imageUrl || '',
          intent: state.textReply ? 'both' : 'image',
          imagePrompt,
          executionLog: newLog
        }
      }
      return { error: result.error || '图片生成失败' }
    }

    case 'final_response': {
      const textReply = parsed.action_input.textReply || state.textReply || ''
      const imageUrl = parsed.action_input.imageUrl || state.imageUrl || ''
      const intent: UnifiedState['intent'] = imageUrl ? 'both' : (textReply ? 'text' : 'unknown')

      return {
        textReply,
        imageUrl,
        intent
      }
    }

    default:
      return { error: `未知行动: ${parsed.action}` }
  }
}

function shouldContinue(state: UnifiedState): string {
  if (state.error) return '__end__'
  if (state.executionLog.length >= MAX_REACT_STEPS) return 'finish'

  const parsed = parseReActOutput(state.agentOutput) || safeFallbackParse(state.agentOutput)

  if (parsed.action === 'final_response') return 'finish'

  if (parsed.action === 'text_generation' && state.imageUrl) return 'reason'
  if (parsed.action === 'image_generation' && state.textReply) return 'reason'

  if (state.textReply && state.imageUrl) return 'finish'

  return 'reason'
}

function buildGraph() {
  const graph = new StateGraph(GraphState)
    .addNode('reason', reasonNode)
    .addNode('act', actNode)
    .addEdge('__start__', 'reason')
    .addConditionalEdges('act', shouldContinue, {
      reason: 'reason',
      finish: '__end__',
      __end__: '__end__'
    })
    .addConditionalEdges('reason', () => 'act')

  return graph.compile()
}

let _compiledGraph: ReturnType<typeof buildGraph> | null = null

function getCompiledGraph() {
  if (!_compiledGraph) {
    _compiledGraph = buildGraph()
  }
  return _compiledGraph
}

export async function runUnifiedGraph(
  userMessage: string,
  history: Array<{ role: string; content: string }> = [],
  options?: {
    reuseCompiledGraph?: boolean
  }
): Promise<UnifiedResponse> {
  const reuseCompiledGraph = options?.reuseCompiledGraph ?? true
  const app = reuseCompiledGraph ? getCompiledGraph() : buildGraph()

  const result = await app.invoke({
    userMessage,
    history,
    executionLog: []
  })

  const intent: UnifiedResponse['intent'] =
    result.intent === 'unknown' ? 'text' : result.intent

  return {
    intent,
    textReply: result.textReply,
    imageUrl: result.imageUrl,
    error: result.error
  }
}

let _graphCompileCount = 0

export function getUnifiedGraphRuntimeStats() {
  return {
    graphCompileCount: _graphCompileCount
  }
}

export function resetUnifiedGraphRuntimeStats(_options?: { resetSingletons?: boolean }) {
  _graphCompileCount = 0
}