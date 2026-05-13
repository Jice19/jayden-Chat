

### **LangChain知识练习题**

#### **一、选择题**

1. LangChain中，哪种模型最适合用于构建多轮对话应用（   B     ）

     A. 大语言模型 (LLM)                                        

     B. 聊天模型 (Chat Model) 

     C. 文本嵌入模型 (Embedding Model)           

     D. 输出解析器 (Output Parser)

   

2. 在LangChain中，用于将用户输入和历史对话消息组合成结构化格式，并传递给聊天模型的组件是（  B      ）

     A. PromptTemplate

     B. ChatPromptTemplate

     C. FewShotPromptTemplate

     D. RunnableSequence

   

3. 如果你想让大模型的输出结果是一个Python字典（json格式），你应该使用哪个输出解析器（  C      ）

   ​	A. StrOutputParser

   ​	B. DatetimeOutputParser

   ​	C. JsonOutputParser

   ​	D. CommaSeparatedListOutputParser

   

4. 在 RAG (检索增强生成) 应用中，负责将文本块和用户查询转换为向量的核心组件是什么（    C    ）

   ​	A. 文档加载器 (Document Loader) 

   ​	B. 文本分割器 (Text Splitter) 

   ​	C. 文本嵌入模型 (Embedding Model) 

   ​	D. 向量数据库 (Vector Store)

   

5. 以下哪个组件可以让你在LangChain的链（Chain）中执行自定义的Python函数（  C      ）

   ​	A. RunnableSequence

   ​	B. RunnableParallel

   ​	C. RunnableLambda

   ​	D. RunnablePassthrough

   

6. 为了使一个聊天机器人能够记住之前的对话内容，你需要使用 LangChain 的哪个功能模块（   C     ）

   ​	A. 工具 (Tools) 

   ​	B. 链 (Chains) 

   ​	C. 记忆 (Memory) 

   ​	D. 中间件 (Middleware)

   

7. 在构建一个简单的翻译链时，以下哪个代码片段正确地使用了管道操作符 (`|`) 来链接组件（  B      ） 

   ​	A. chain = model | prompt | StrOutputParser()

   ​	B. chain = prompt | model | StrOutputParser()

   ​	C. chain = StrOutputParser() | prompt | model

   ​	D. chain = prompt + model + StrOutputParser()

   

8.  RunnableWithMessageHistory的主要作用是什么（  B      ） 

   ​	A. 并行执行多个任务。 

   ​	B. 自动管理对话历史，使得链具备记忆能力。 

   ​	C. 将非结构化数据转换为 JSON 格式。 

   ​	D. 对长文本进行摘要压缩。

   

9. 在LangChain中，如果你想从一个PDF文件中加载内容以供后续处理，你应该使用哪个文档加载器（   D     ） 

   ​	A. TextLoader

   ​	B. CSVLoader

   ​	C. JSONLoader

   ​	D. PyPDFLoader

   

10.  在 RAG 架构中，检索器调用 retriever.invoke("用户的问题") 这行代码的作用是什么（   B     ） 

    ​	A. 直接让大模型回答用户的问题。 

    ​	B. 在向量数据库中搜索与“用户的问题”最相关的文档片段。 

    ​	C. 将“用户的问题”转换为嵌入向量。 

    ​	D. 清空向量数据库中的所有内容。





#### **二、判断题**

1. 大语言模型 (LLM) 和聊天模型 (Chat Model) 在 LangChain 中是完全相同的概念，可以互换使用。 (   ❌    )
2. RunnablePassthrough组件的主要作用是在链中传递数据而不做任何修改，常用于需要保留原始输入的场景。 (   ✅   )
3. RedisChatMessageHistory可以将对话历史存储在 Redis 数据库中，从而实现持久化，即使服务重启也不会丢失。 (  ✅     )
4. 在使用 create_agent创建智能体时，必须为其绑定至少一个工具 Tool，否则无法工作。 ( ❌      )
5. LangChain表达式 (LCEL) 是一种通过声明式方式（使用 `|` 管道符）来链接不同组件以构建应用的方法。 ( ✅   )















---

### **答案与解析**

#### **一、选择题**

1. B

   - **解析**：聊天模型 (Chat Model) 的 API 设计就是围绕一系列聊天消息（system、user、assistant）进行的，天然支持多轮对话的上下文传递。

2. B

   - **解析**：`ChatPromptTemplate` 专门用于组合不同角色（系统、人类、AI）的消息，形成符合聊天模型要求的输入格式。

3. C

   - **解析**：`JsonOutputParser` 的作用就是解析模型返回的结果为json格式，并将其转换为Python字典。

4. C

   - **解析**：文本嵌入模型 (Embedding Model) 是 RAG 的核心，它负责将文本语义信息编码为高维向量，是后续进行向量相似度检索的基础。

5. C

   - **解析**：`RunnableLambda` 可以将任意的 Python 函数包装成一个 `Runnable` 对象，从而可以无缝集成到 LCEL 链中。

6. C

   - **解析**：记忆 (Memory) 模块，如 `ChatMessageHistory`，就是用来存储和管理对话历史，解决大模型本身无状态的问题。

7. B

   - **解析**：数据流的正确顺序是：先通过提示词模板 (`prompt`) 格式化输入，然后交给模型 (`model`) 处理，最后用输出解析器 (`StrOutputParser`) 格式化结果。

8. B

   - **解析**：`RunnableWithMessageHistory`  能自动处理对话历史的获取和存储，让底层的链无需关心记忆逻辑。

9. D

   - **解析**：`PyPDFLoader` 是 LangChain 中专门用于加载 PDF 文档内容的加载器。

10. B

    - **解析**：检索器 (Retriever) 的核心功能就是在知识库（通常是向量数据库）中查找与查询最相关的文档或文本片段。

    

#### **二、判断题**

1. ×
   - **解析**：两者不同。LLM 通常指文本补全模型，输入输出都是纯字符串；而 Chat Model 输入是一系列消息，输出也是一个消息对象，更适合对话。
2. √
   - **解析**：这是 `RunnablePassthrough` 的基本功能，它确保数据原样传递到链的下一步。
3. √
   - **解析**：Redis 是一个内存数据库，但数据可以持久化到磁盘，因此使用 `RedisChatMessageHistory` 可以实现对话历史的长期保存。
4. ×
   - **解析**：智能体 (Agent) 的核心能力是“决定是否以及如何调用工具”，但一个没有绑定任何工具的智能体仍然可以作为一个普通的聊天机器人工作。
5. √
   - **解析**：LCEL 的核心思想就是通过声明式的管道 (`|`) 操作符，像搭积木一样直观地组合各种组件。

