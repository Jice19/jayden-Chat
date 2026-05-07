# RAG 优化需求文档（摘要索引 + 多路召回 + 重排）

## 1. 背景
- 当前 RAG 以「原文切片 + 向量检索 + 直接生成」为主，缺少摘要索引、多路查询扩展、重排与上下文精排机制。
- 在复杂问题或表述不一致场景下，容易出现召回不足、噪音片段较多、最终答案稳定性不够的问题。

## 2. 目标
- 将用户文档改造为「切片原文 + 摘要索引」双存储形态。
- 摘要向量检索负责高效召回，原文存储负责高质量回答。
- 构建多路召回（Query Expansion）与重排（Qwen Reranker）链路，提高相关性。
- 最终只注入重排 Top5 文档上下文，降低上下文噪音，提升答案质量与可控性。

## 3. 范围
### 3.1 本次范围
- 文档入库链路重构：
  - LangChain 递归切分。
  - 切片摘要提取。
  - 摘要向量入向量库。
  - 原文切片入文档存储（Redis 或 PostgreSQL）。
  - 摘要与原文通过 UUID 强关联。
- 问答检索链路重构：
  - 用户问题预处理。
  - AI 生成多路相似问题。
  - 多路查询并行检索，召回 Top-K=20。
  - 摘要关键词匹配原文切片。
  - Qwen 重排后取 Top5 作为最终上下文。
  - 基于上下文生成最终回答。

### 3.2 暂不在本次范围
- 多模态内容（图片、音频）检索。
- 跨用户共享知识库。
- 在线学习反馈闭环（如用户点赞后自动微调策略）。

## 4. 关键术语
- 文档（Document）：用户上传文件级实体。
- 切片（Chunk）：由递归切分得到的文本片段。
- 摘要索引（Summary Index）：针对每个 Chunk 抽取的短摘要和关键词。
- 召回（Recall）：在向量库中找出候选摘要。
- 重排（Rerank）：对候选原文按问题相关性重新排序。

## 5. 总体架构
1. Ingestion（入库）
   - 原文解析 -> 递归切分 -> 摘要提取 -> 摘要向量化 -> 摘要写入向量库
   - 原文切片写入文档存储
   - `summary_uuid` 与 `chunk_uuid` 绑定
2. Retrieval（检索）
   - 问题清洗 -> 多路 Query 生成 -> 并行向量检索（Top20）
   - 摘要关键词与文档切片匹配，组装候选文档
3. Ranking（精排）
   - Qwen Reranker 对候选文档重排
   - 取 Top5 文档作为上下文
4. Generation（生成）
   - Prompt 注入 Top5 上下文
   - Qwen LLM 生成最终回答（含引用）

## 6. 数据模型与关联设计
### 6.1 主实体
- `rag_document`
  - `document_uuid`
  - `user_id`
  - `title`
  - `source`
  - `created_at` / `updated_at`
- `rag_chunk`
  - `chunk_uuid`
  - `document_uuid`
  - `chunk_index`
  - `chunk_content`
  - `token_count`
  - `created_at`
- `rag_summary_index`
  - `summary_uuid`
  - `chunk_uuid`
  - `document_uuid`
  - `summary_text`
  - `keywords`（数组）
  - `embedding_model`
  - `embedding_vector`（仅向量库存储）
  - `created_at`

### 6.2 UUID 关联规则
- 每个切片生成唯一 `chunk_uuid`。
- 每个摘要索引生成唯一 `summary_uuid`。
- `rag_summary_index.chunk_uuid = rag_chunk.chunk_uuid`。
- `rag_summary_index.document_uuid = rag_document.document_uuid`。
- 检索返回以 `summary_uuid` 为主键，再反查 `chunk_uuid` 获取原文。

## 7. 存储方案
### 7.1 向量存储（摘要）
- 存储对象：`summary_text + embedding + metadata(summary_uuid, chunk_uuid, document_uuid, user_id)`。
- 建议：
  - 继续使用 PostgreSQL + pgvector（便于与当前项目一致）。
  - 或切换 Milvus/ES 向量引擎（后续可选）。

### 7.2 文档存储（原文切片）
- 可选 A：PostgreSQL
  - 优点：事务、关系查询、一致性强，适合摘要与原文强关联。
  - 缺点：高吞吐下读写压力需优化索引。
- 可选 B：Redis
  - 优点：高吞吐、低延迟，适合热数据。
  - 缺点：持久化与复杂查询能力弱，需额外一致性设计。
- 本项目建议：优先 PostgreSQL（首版），Redis 作为缓存层（增强版）。

## 8. 入库流程详细要求
1. 文档接收后进行类型、大小、安全校验。
2. 使用 LangChain `RecursiveCharacterTextSplitter` 切分：
   - `chunkSize`：建议 600~1000 字符
   - `chunkOverlap`：建议 100~150 字符
3. 对每个 Chunk 生成摘要与关键词：
   - 摘要长度建议 80~200 字。
   - 输出结构：`{ summary, keywords[] }`
4. 对摘要向量化并写入向量库。
5. 原文切片写入文档存储。
6. 写入关联映射（`summary_uuid <-> chunk_uuid <-> document_uuid`）。
7. 任一阶段失败时记录失败状态，支持重试与幂等。

## 9. 检索流程详细要求
1. 问题预处理：
   - 去噪（空白、无效符号、超长截断）。
   - 基础安全过滤（Prompt 注入关键词拦截/转义）。
2. 多路召回 Query 生成：
   - 使用 AI 生成 3~5 条语义近似问题。
   - 与原问题组成查询集合。
3. 并行检索：
   - 每路检索摘要向量库，合并去重后保留 Top-K=20。
4. 摘要到原文映射：
   - 按 `summary_uuid -> chunk_uuid` 反查原文切片。
   - 用摘要关键词进行一次关键词匹配过滤（提升精度）。
5. 重排：
   - 输入：`原问题 + 候选文档列表`
   - 模型：Qwen 重排模型（Reranker）
   - 输出：按相关性排序，取 Top5。
6. 生成：
   - 将 Top5 原文切片注入 Prompt。
   - 返回最终回答 + 引用来源（`document_uuid/chunk_uuid`）。

## 10. Prompt 工程要求
- 系统提示词必须包含：
  - 仅根据提供上下文回答。
  - 未覆盖时明确说明，不得臆造。
  - 优先输出可验证结论，并附引用编号。
- 用户提示词建议结构：
  - `Question`
  - `Retrieved Context (Top5)`
  - `Output Format`

## 11. API 变更建议
- `POST /api/rag/documents/upload`
  - 入库后触发摘要索引构建任务。
- `POST /api/rag/documents/reindex`
  - 支持按文档重建切片 + 摘要 + 向量。
- `POST /api/rag/ask`
  - 新增字段：
    - `recallTopK`（默认 20）
    - `rerankTopN`（默认 5）
    - `queryExpansionCount`（默认 3~5）
    - `debug`（默认 false，仅调试模式返回可观测过程）
  - 响应新增：
    - `recallQueries`
    - `retrievedSummaries`
    - `rerankedChunks`

## 12. 可观测调试模式（AI 过程可视化）
- 目标：支持“过程可见”，但不返回模型原始思维链（chain-of-thought）。
- 开关：
  - 请求参数 `debug=true` 时开启，仅对当前登录用户生效。
  - 生产环境可通过服务端配置强制关闭或仅白名单可用。
- `POST /api/rag/ask` 在 `debug=true` 时额外返回：
  - `debugTrace.queryExpansion`：多路召回问题列表
  - `debugTrace.recallCandidates`：Top-K=20 摘要候选（含分数、summary_uuid）
  - `debugTrace.keywordMatches`：摘要关键词与原文切片匹配结果
  - `debugTrace.rerankScores`：Qwen 重排前后顺序与分数
  - `debugTrace.finalContext`：最终注入 Prompt 的 Top5 片段标识
  - `debugTrace.latency`：召回、重排、生成各阶段耗时
  - `debugTrace.traceId`：链路追踪 ID
- 安全要求：
  - 禁止返回模型隐式推理文本、系统提示词原文、密钥与敏感配置。
  - 日志与响应均需脱敏（用户隐私、路径、token）。
- 降级策略：
  - 若重排失败，`debugTrace` 标注 `rerankDegraded=true`，并记录兜底策略。

## 13. 非功能要求
- 性能：
  - 单次问答检索耗时目标 P95 < 2.5s（不含生成阶段）。
  - 文档入库支持异步任务化，避免阻塞上传接口。
- 可靠性：
  - 任务失败可重试，保证幂等。
  - 写入失败不产生脏关联（事务或补偿机制）。
- 安全：
  - 用户数据隔离（按 `user_id` 强约束）。
  - 上传文件校验、路径安全、防注入处理。
- 可观测性：
  - 记录召回命中数、重排分数、最终引用命中率、端到端耗时。

## 14. 验收标准（DoD）
- 文档可完成「递归切分 -> 摘要索引 -> 关联存储」全链路入库。
- 问答流程可完成「多路召回 Top20 -> Qwen 重排 -> Top5 上下文生成」。
- 返回结果包含可追溯引用（`document_uuid/chunk_uuid`）。
- 在至少 20 条样例问答中，答案相关性和稳定性优于当前版本。
- 全部接口通过类型检查与 lint 校验。
- `debug=true` 时可返回结构化检索与重排轨迹，且不暴露原始思维链。

## 15. 风险与应对
- 摘要偏差导致误召回：
  - 增加关键词抽取 + 原文匹配双保险。
- 多路召回带来噪音：
  - 严格 TopK、去重和重排阈值控制。
- 重排成本升高：
  - 支持按问题长度动态降级（小问题可直接召回后生成）。
- Redis 与 PG 双写复杂：
  - 首版采用 PG 单写，Redis 只做缓存，避免一致性风险。
