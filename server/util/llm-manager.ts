import { ChatOpenAI } from '@langchain/openai'
import { getApiKey } from './get-api-key'

let _llmInstance: ChatOpenAI | null = null
let _llmCreateCount = 0

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

export function getLLM(): ChatOpenAI {
  if (!_llmInstance) {
    _llmInstance = createLLMInstance()
  }
  return _llmInstance
}

export function createNewLLMInstance(): ChatOpenAI {
  return createLLMInstance()
}

export interface LLMStats {
  llmCreateCount: number
}

export function getLLMStats(): LLMStats {
  return { llmCreateCount: _llmCreateCount }
}