# LangChain & LangGraph 学习路线

> 从零基础到构建多智能体应用的完整路径

---

## 总览

```
阶段一          阶段二            阶段三           阶段四
Python基础  →  LangChain核心  →  LangGraph图  →  生产级应用
（1-2周）       （2-3周）          （2-3周）        （持续）
```

---

## 阶段一：前置基础

### 1.1 Python 基础（已有经验可跳过）
- [ ] 函数、类、装饰器
- [ ] 异步编程（`async/await`、`asyncio`）
- [ ] 类型注解（`TypedDict`、`Annotated`）
- [ ] 虚拟环境管理（`venv` / `conda` / `uv`）

### 1.2 AI/LLM 基本概念
- [ ] 什么是 Token、Temperature、Top-P
- [ ] System Prompt / User Prompt / Assistant 角色区别
- [ ] 什么是 Embedding（向量嵌入）
- [ ] 什么是 RAG（检索增强生成）
- [ ] 流式输出（Streaming）原理

### 1.3 环境准备
```bash
pip install langchain langchain-openai langgraph
pip install langchain-community python-dotenv
```

---

## 阶段二：LangChain 核心

> LangChain 是"乐高积木"，提供与 LLM 交互的标准化组件

### 2.1 核心概念：LCEL（LangChain 表达式语言）

```
重点：用 | 管道符把组件串联起来

prompt | model | output_parser
```

- [ ] 什么是 Runnable 接口（`.invoke` / `.stream` / `.batch`）
- [ ] 如何用 `|` 组合 chain
- [ ] `RunnableParallel`（并行执行）
- [ ] `RunnablePassthrough`（透传输入）

**练习项目：简单问答 Chain**
```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个助手"),
    ("user", "{question}")
])
model = ChatOpenAI(model="gpt-4o")
chain = prompt | model
chain.invoke({"question": "什么是量子纠缠？"})
```

---

### 2.2 提示词工程（Prompt Templates）

- [ ] `ChatPromptTemplate`（对话模板）
- [ ] `PromptTemplate`（字符串模板）
- [ ] `FewShotPromptTemplate`（少样本学习）
- [ ] `MessagesPlaceholder`（动态插入历史消息）

**关键点**：Prompt 是 LangChain 里最值钱的东西，写好 Prompt = 成功一半

---

### 2.3 输出解析器（Output Parsers）

- [ ] `StrOutputParser`（纯文本输出）
- [ ] `JsonOutputParser`（JSON 格式输出）
- [ ] `PydanticOutputParser`（结构化输出，带校验）
- [ ] `CommaSeparatedListOutputParser`（列表输出）

**练习：让 LLM 稳定输出 JSON**
```python
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel

class Intent(BaseModel):
    intent: str      # "text" | "image" | "both"
    prompt: str

parser = JsonOutputParser(pydantic_object=Intent)
chain = prompt | model | parser
```

---

### 2.4 记忆（Memory）与历史

- [ ] `ChatMessageHistory`（内存存储）
- [ ] `RedisChatMessageHistory`（持久化存储）
- [ ] `ConversationBufferMemory` vs `ConversationSummaryMemory`
- [ ] `RunnableWithMessageHistory`（把记忆注入 Chain）

**关键点**：记忆决定了对话是否"认识你"，本项目里用数据库存历史就是这个思路

---

### 2.5 工具调用（Tool Calling）

> 这是 LangChain 最强大的特性，让 LLM 能"调用外部函数"

- [ ] 用 `@tool` 装饰器定义工具
- [ ] `bind_tools`：把工具绑定到模型
- [ ] 工具的输入输出类型定义
- [ ] 处理工具调用结果（`ToolMessage`）

**练习：天气查询工具**
```python
from langchain_core.tools import tool

@tool
def get_weather(city: str) -> str:
    """查询指定城市的天气"""
    return f"{city}今天晴天，25°C"

model_with_tools = model.bind_tools([get_weather])
```

---

### 2.6 RAG（检索增强生成）

- [ ] 文档加载器（`PyPDFLoader`、`WebBaseLoader`）
- [ ] 文本分割（`RecursiveCharacterTextSplitter`）
- [ ] Embedding 模型（`OpenAIEmbeddings`）
- [ ] 向量数据库（`Chroma`、`FAISS`、`Pinecone`）
- [ ] Retriever（检索器）
- [ ] 构建完整 RAG Pipeline

**练习项目：给自己的文档建知识库问答**

---

## 阶段三：LangGraph 核心

> LangGraph 是"流程图引擎"，让你的 AI 应用能循环、分支、并行

### 3.1 核心概念理解

```
┌─────────────────────────────────────────┐
│              LangGraph 图               │
│                                         │
│  State（状态）                          │
│  贯穿整个图的共享数据                    │
│                                         │
│  Node（节点）                           │
│  接受 State → 处理 → 返回 Partial State  │
│                                         │
│  Edge（边）                             │
│  固定边：A → B                          │
│  条件边：A → f(state) → B 或 C          │
└─────────────────────────────────────────┘
```

- [ ] State 的设计原则（用 `TypedDict` 或 `Annotation`）
- [ ] Node 的写法（纯函数，接受 state 返回字典）
- [ ] 固定边 `add_edge`
- [ ] 条件边 `add_conditional_edges`
- [ ] `__start__` 和 `__end__` 特殊节点
- [ ] `graph.compile()` 编译图

**最小可运行示例**
```python
from langgraph.graph import StateGraph, END
from typing import TypedDict

class State(TypedDict):
    message: str
    result: str

def process(state: State):
    return {"result": f"处理了：{state['message']}"}

graph = StateGraph(State)
graph.add_node("process", process)
graph.set_entry_point("process")
graph.add_edge("process", END)
app = graph.compile()
app.invoke({"message": "hello"})
```

---

### 3.2 State 设计（重点）

- [ ] `TypedDict` vs `Annotated` + `reducer` 的区别
- [ ] Reducer 函数：决定多节点写同一字段时如何合并
  - `operator.add`：列表追加
  - `lambda a, b: b`：后者覆盖前者
- [ ] 默认值设置

**本项目用到的模式**
```python
from langgraph.graph import Annotation

State = Annotation.Root({
    "messages": Annotation[list](reducer=operator.add),  # 追加消息
    "intent": Annotation[str](reducer=lambda a, b: b),   # 覆盖意图
})
```

---

### 3.3 条件路由（Routing）

> 这是 LangGraph 最核心的能力：根据状态动态决定下一步

- [ ] 路由函数的写法（返回字符串 key）
- [ ] `add_conditional_edges` 的 mapping 参数
- [ ] 多分支路由
- [ ] 路由到 END 的写法

**练习：意图路由（本项目核心）**
```python
def route(state):
    if state["intent"] == "image":
        return "image_node"
    elif state["intent"] == "both":
        return "text_node"
    return "text_node"

graph.add_conditional_edges("router", route, {
    "text_node": "text_node",
    "image_node": "image_node",
})
```

---

### 3.4 循环与人机交互（Human-in-the-Loop）

> Agent 最强大的能力：自主循环直到任务完成

- [ ] 循环图设计（节点可以回到前面的节点）
- [ ] `interrupt_before` / `interrupt_after`（暂停等待人类输入）
- [ ] Checkpointer（断点持久化）
  - `MemorySaver`（内存保存）
  - `SqliteSaver`（SQLite 持久化）
- [ ] `thread_id`：多用户会话隔离

**应用场景**：让 AI 生成方案 → 人类审核 → AI 继续执行

---

### 3.5 并行执行（Parallel Nodes）

- [ ] `Send` API：动态创建并行任务
- [ ] `fan-out / fan-in` 模式（分发 → 并行处理 → 汇总）
- [ ] 注意：并行节点写入同一字段时必须用 list reducer

**练习：同时生成多张图片**
```python
from langgraph.types import Send

def fan_out(state):
    # 把 3 个提示词同时发给 generate_image 节点
    return [Send("generate_image", {"prompt": p}) for p in state["prompts"]]

graph.add_conditional_edges("start", fan_out)
```

---

### 3.6 预置架构（重要！节省大量时间）

LangGraph 内置了几种常见 Agent 架构，直接用：

- [ ] `create_react_agent`：ReAct 循环（推理 + 行动）
- [ ] `create_tool_calling_executor`：工具调用 Agent
- [ ] `langgraph.prebuilt`：预置组件包

**练习：用 5 行代码创建一个能搜索的 Agent**
```python
from langgraph.prebuilt import create_react_agent

agent = create_react_agent(model, tools=[search_tool, calculator_tool])
result = agent.invoke({"messages": [("user", "北京今天天气怎么样？")]})
```

---

## 阶段四：多智能体系统

> 多个 Agent 协作完成复杂任务，这是目前 AI 工程的前沿

### 4.1 多 Agent 架构模式

```
模式一：Supervisor（监督者）
  主管 Agent 分配任务给子 Agent

  Supervisor
  ├── 研究员 Agent（搜索信息）
  ├── 写作员 Agent（生成文章）
  └── 审核员 Agent（质量把关）

模式二：Swarm（蜂群）
  Agent 之间互相传递控制权

  Agent A → Agent B → Agent C → Agent A...

模式三：Hierarchical（层级）
  多层 Supervisor 管理多层 Agent
```

- [ ] 理解 `Command` 对象（Agent 间通讯）
- [ ] `handoff`（控制权移交）
- [ ] 子图（Subgraph）：把一个图嵌入另一个图
- [ ] 跨 Agent 共享状态

---

### 4.2 LangGraph Platform（托管平台）

- [ ] LangGraph Server：部署图为 API 服务
- [ ] LangGraph Studio：可视化调试图（强烈推荐！）
- [ ] `langgraph.json` 配置文件
- [ ] `LangSmith`：观测、追踪、评估（必学！）

---

### 4.3 流式输出（Streaming）

- [ ] `stream_mode="values"`：每次 state 更新时输出
- [ ] `stream_mode="updates"`：每次节点返回时输出
- [ ] `stream_mode="messages"`：逐 Token 流式输出
- [ ] 在 Web 应用中用 SSE 传递流式结果

---

## 阶段五：工程化实践

### 5.1 可观测性（Observability）
- [ ] 接入 LangSmith（Trace 每次调用）
- [ ] 自定义 Callback（记录关键节点）
- [ ] 评估 LLM 输出质量

### 5.2 测试
- [ ] 单元测试：测试每个 Node 函数
- [ ] 集成测试：测试完整 Graph
- [ ] 使用 `pytest` + `mock` 模拟 LLM 返回

### 5.3 性能优化
- [ ] 缓存 LLM 调用（`SQLiteCache`）
- [ ] 批量处理（`.batch()`）
- [ ] 异步调用（`.ainvoke()` / `.astream()`）

---

## 推荐练习项目（按难度排序）

| 难度 | 项目 | 用到的知识 |
|------|------|-----------|
| ⭐ | 简单问答 Bot | ChatModel + PromptTemplate |
| ⭐⭐ | 带记忆的对话助手 | Memory + ConversationChain |
| ⭐⭐ | PDF 知识库问答 | RAG + Chroma |
| ⭐⭐⭐ | 意图路由 Agent（本项目）| LangGraph + 条件边 |
| ⭐⭐⭐ | 自主搜索 Agent | ReAct + Tool Calling + 循环 |
| ⭐⭐⭐⭐ | 代码生成+执行 Agent | 人机交互 + Python REPL 工具 |
| ⭐⭐⭐⭐ | 多 Agent 写作系统 | Supervisor 架构 + 子图 |
| ⭐⭐⭐⭐⭐ | 生产级 AI 应用 | LangGraph Platform + LangSmith |

---

## 推荐资源

### 官方文档
- LangChain 文档：https://python.langchain.com
- LangGraph 文档：https://langchain-ai.github.io/langgraph
- LangSmith 文档：https://docs.smith.langchain.com

### 学习顺序建议
1. LangGraph 官方教程（Tutorials）：从 Quick Start 开始
2. LangGraph How-to Guides：按需查阅具体功能
3. LangChain Academy 免费课程（免费，英文）
4. DeepLearning.AI 上的 LangChain 课程（免费，英文）

### 调试神器
- **LangGraph Studio**：可视化看图的执行过程，强烈推荐本地装一个
- **LangSmith**：每次调用都有完整 Trace，定位问题很快

---

## 当前项目（jayden-Chat）对应的知识点

```
已实现：
├── PromptTemplate          → router 节点里的 system prompt
├── ChatOpenAI              → 对接阿里云 qwen-plus
├── StateGraph + Annotation → unified-graph.ts 里的图结构
├── 条件路由                → routeByIntent 函数
└── Tool 调用思路           → imageNode 调用文生图 API

下一步可以加：
├── Memory + Checkpointer   → 跨对话的记忆持久化
├── Human-in-the-Loop       → 生成图片前让用户确认提示词
├── 流式输出                → 让文字回复也能流式显示
└── LangSmith 接入          → 观测每次路由决策是否准确
```

---

> 学习建议：**边学边做**，每个阶段完成后立即在 jayden-Chat 项目里实践，理解会深很多。
```
