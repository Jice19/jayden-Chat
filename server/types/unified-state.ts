import { Annotation } from '@langchain/langgraph'

export const GraphState = Annotation.Root({
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