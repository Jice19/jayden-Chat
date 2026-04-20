# 个人 RAG 知识库落地设计（含上传管理）

## 1. 目标与范围

### 1.1 业务目标
- 基于个人学习笔记构建私有知识库，支持问答、知识总结、面试复盘。
- 支持页面上传与管理知识库文档（上传、列表、检索、重建索引、删除）。
- 在现有 Nuxt + PostgreSQL 项目内落地，优先低运维、低耦合、可持续迭代。

### 1.2 MVP 范围
- 文档来源：用户在页面上传的 `md/txt/pdf/docx`（首期可先 `md/txt/pdf`）。
- RAG 流程：解析 -> 分块 -> 向量化 -> 检索 -> 生成。
- 检索模式：向量召回 + 元数据过滤（标签、时间、来源）。
- 输出能力：回答附引用片段来源（文档名 + 分块序号）。

### 1.3 非目标（首期不做）
- 多租户企业级权限体系（只做当前登录用户隔离）。
- 复杂工作流编排平台化（先在项目内实现，不接入 Dify/RAGFlow 控制台）。
- 混合检索中的重排序模型（先预留接口，后续迭代）。

## 2. 技术清单（成熟、可落地）

### 2.1 后端与模型
- `Nuxt 4 (Nitro)`：API 与服务编排。
- `LangChain.js`：分块、向量存储抽象、检索链路。
- `Qwen Embedding`：文本向量化（推荐 `text-embedding-v3` 或同级稳定型号）。
- `Qwen Plus`：RAG 最终生成模型（已在项目中使用，复用现有调用能力）。

### 2.2 数据与存储
- `PostgreSQL`：结构化元数据与分块文本持久化。
- `pgvector`：向量字段与近邻检索能力。
- `Prisma`：关系模型与 CRUD。
- 本地文件存储（MVP）：`/uploads/kb`（后续可切 OSS/S3）。

### 2.3 文档解析
- `markdown-it` 或 `remark`：Markdown 解析。
- `pdf-parse`：PDF 文本提取。
- `mammoth`：DOCX 文本提取（可选，第二步接入）。
- `sanitize-html`：文本清洗，规避脏内容影响索引质量。

### 2.4 前端
- `Vue3 + Composition API + <script setup> + TypeScript`。
- 上传：浏览器 `File API` + Axios 分片/进度 + 断点续传。
- `Web Worker`：大文件 `hash` 计算（避免主线程卡顿）。
- 管理页：文档列表、状态筛选、重建索引、删除、预览引用。

### 2.5 安全与治理
- 鉴权：复用现有 JWT + 中间件。
- 上传校验：MIME、扩展名、大小限制、病毒扫描接口预留。
- 路径安全：服务端重命名、防目录穿越。
- 内容隔离：所有 RAG 查询默认带 `userId` 过滤。

## 3. 架构设计

### 3.1 逻辑分层
- `Ingestion`：文档接收、解析、清洗、分块、向量化、入库。
- `Retrieval`：查询重写（可选）、向量检索、过滤、上下文构造。
- `Generation`：基于检索上下文生成答案并返回引用来源。
- `Management`：上传、列表、重建、删除、状态监控。

### 3.2 数据流
1. 前端上传文档到 `POST /api/rag/documents/upload`。
2. 后端落盘并创建文档记录（`PENDING`）。
3. 异步任务解析/分块/向量化，写入 `rag_chunk`，文档状态置为 `READY`。
4. 用户提问调用 `POST /api/rag/ask`，按 `userId + filters` 检索并生成回答。
5. 返回 `answer + references`，前端可查看引用来源。

## 4. 数据库设计（Prisma + pgvector）

### 4.1 表结构
- `rag_document`
  - `id` (uuid)
  - `userId` (string, index)
  - `title` (string)
  - `sourceType` (`upload` | `sync`)
  - `filePath` (string)
  - `fileType` (string)
  - `fileSize` (int)
  - `status` (`PENDING` | `PROCESSING` | `READY` | `FAILED`)
  - `tags` (jsonb)
  - `errorMessage` (nullable)
  - `createdAt` / `updatedAt`

- `rag_chunk`
  - `id` (uuid)
  - `documentId` (fk -> rag_document.id, index)
  - `userId` (string, index)
  - `chunkIndex` (int)
  - `content` (text)
  - `contentHash` (string, index)
  - `tokenCount` (int)
  - `metadata` (jsonb)
  - `embedding` (vector(1024/1536，按模型维度))
  - `createdAt`

- `rag_query_log`（可选，建议首期保留）
  - `id`, `userId`, `query`, `mode`, `topK`, `latencyMs`, `createdAt`

- `rag_upload_session`（大文件上传会话）
  - `id` (uuid)
  - `userId` (string, index)
  - `fileName` (string)
  - `fileHash` (string, unique with userId)
  - `fileSize` (bigint)
  - `chunkSize` (int)
  - `totalChunks` (int)
  - `uploadedChunks` (jsonb/int array)
  - `status` (`INIT` | `UPLOADING` | `MERGING` | `DONE` | `FAILED`)
  - `storagePath` (string, nullable)
  - `expiresAt` (timestamp)
  - `createdAt` / `updatedAt`

### 4.2 索引建议
- `rag_document(userId, status, createdAt desc)`
- `rag_chunk(userId, documentId, chunkIndex)`
- `rag_chunk using hnsw (embedding vector_cosine_ops)`（pgvector）
- `rag_chunk(contentHash)` 去重优化

## 5. API 设计

### 5.1 文档管理
- `POST /api/rag/documents/upload`
  - 入参：`multipart/form-data`（file, title?, tags?）
  - 出参：`documentId`, `status`

- `GET /api/rag/documents`
  - 入参：`page`, `pageSize`, `status`, `keyword`
  - 出参：分页列表（含状态、错误信息、更新时间）

- `POST /api/rag/documents/:id/reindex`
  - 作用：重新解析与重建向量

- `DELETE /api/rag/documents/:id`
  - 作用：删除文档与分块向量（软删或硬删按策略）

### 5.2 大文件上传（分片/秒传/续传）
- `POST /api/rag/uploads/init`
  - 入参：`fileName`, `fileHash`, `fileSize`, `chunkSize`
  - 出参：
    - `uploadId`
    - `shouldUpload`（false 表示命中秒传）
    - `uploadedChunkIndexes`（用于断点续传）

- `PUT /api/rag/uploads/chunk`
  - 入参：`multipart/form-data`（`uploadId`, `chunkIndex`, `chunkHash`, `chunkFile`）
  - 出参：`ok`, `chunkIndex`

- `POST /api/rag/uploads/complete`
  - 入参：`uploadId`, `fileHash`
  - 出参：`documentId`, `status`

- `GET /api/rag/uploads/:uploadId/status`
  - 出参：`status`, `uploadedChunkIndexes`, `progress`

### 5.3 RAG 问答
- `POST /api/rag/ask`
  - 入参：
    - `question: string`
    - `mode: "qa" | "review" | "summary"`
    - `filters?: { tags?: string[]; documentIds?: string[] }`
    - `topK?: number`（默认 5）
  - 出参：
    - `answer: string`
    - `references: Array<{ documentId; title; chunkIndex; snippet }>`
    - `usedChunks: number`
    - `latencyMs: number`

## 6. 页面与交互设计（支持上传管理）

### 6.1 新增页面
- `app/pages/rag.vue`：知识库助手主页面
- `app/components/rag/KnowledgeUploader.vue`
- `app/components/rag/KnowledgeTable.vue`
- `app/components/rag/RagChatPanel.vue`
- `app/composables/useRag.ts`

### 6.2 页面模块
- 左侧：文档管理
  - 上传区（拖拽/点击上传）
  - 文档列表（状态、大小、标签、时间）
  - 操作按钮（重建索引、删除）
- 右侧：RAG 对话区
  - 模式切换（问答/复盘/总结）
  - 问题输入与回答显示
  - 引用来源折叠面板

### 6.3 上传与状态
- 上传后立即显示 `PENDING` 行。
- 后端任务处理中显示 `PROCESSING`。
- 完成后 `READY`，失败显示 `FAILED + errorMessage`。
- 前端轮询或 SSE 推送刷新状态（首期建议轮询，简单稳定）。

### 6.4 大文件上传能力（重点）
- 分片上传：默认 `5MB` 一片，支持并发上传（建议并发 3~4）。
- 断点续传：页面刷新后根据 `uploadId + uploadedChunkIndexes` 继续上传缺失分片。
- 秒传：前端计算 `fileHash`，服务端若检测已存在同 `userId + fileHash` 文件，直接返回 `shouldUpload=false` 并创建文档记录。
- Web Worker 计算哈希：采用 `SparkMD5` 分片计算整文件 hash，避免阻塞 UI。
- 上传暂停/继续：前端可中断并保留会话，下次继续。

### 6.5 前端上传状态机
- `IDLE`：待上传
- `HASHING`：Worker 计算 hash
- `INIT`：创建上传会话
- `UPLOADING`：分片并发上传
- `PAUSED`：手动暂停或网络中断
- `MERGING`：服务端合并
- `PROCESSING`：文档解析与向量化
- `DONE`：完成
- `FAILED`：失败（可重试）

## 7. 关键 Prompt 设计

### 7.1 通用约束
- 仅基于提供的上下文回答；无法确定时明确说“知识库未覆盖”。
- 输出引用编号，避免幻觉。

### 7.2 三种模式模板
- `qa`：直接回答 + 关键知识点 + 引用。
- `review`：基于题目与用户答案给出优点、缺口、改进表达、追问清单。
- `summary`：按“定义/原理/场景/易错点/面试表达”结构化总结。

## 8. 安全设计

- 所有接口必须经过登录校验，按 `userId` 做数据隔离。
- 上传限制：类型白名单、大小限制（如 20MB）、文件名重写。
- 分片校验：每片 `chunkHash` 校验，合并后 `fileHash` 二次校验，防止篡改与脏写。
- 防 prompt 注入：检索文本进入 LLM 前做规则过滤（移除“忽略上文”等指令片段）。
- 审计日志：记录上传、删除、重建、问答请求摘要。

## 9. 性能与质量

- 分块策略：`chunkSize=500~800` 字符，`overlap=80~120`。
- 检索策略：`topK=5` 起步，可按 query 长度动态调整。
- 缓存策略：对高频 query 做短期缓存（可选）。
- 上传性能：分片并发、失败分片重试（指数退避）、Worker hash、合并后异步入库。
- 质量指标：
  - 命中率（引用相关性）
  - 回答可用率
  - 平均响应时延
  - 上传成功率、平均上传耗时、断点恢复成功率

## 10. 实施计划（两周）

### 第 1 周（MVP）
- 建表与 `pgvector` 扩展接入
- 上传接口（含分片/续传基础）+ 文档解析 + 分块 + 向量化
- 文档管理页（上传/列表/删除）
- 基础 `rag/ask`（qa 模式）

### 第 2 周（增强）
- `review/summary` 模式
- 引用来源展示优化
- 重建索引与失败重试
- 秒传 + Worker hash + 上传状态机完善
- 评估与参数调优

## 13. 分片上传协议细节（建议实现标准）

### 13.1 分片参数建议
- `chunkSize`：`5 * 1024 * 1024`（5MB）
- `maxConcurrency`：`3`
- `maxRetryPerChunk`：`3`
- `uploadSessionTTL`：`24h`

### 13.2 秒传判定规则
- 若同用户存在 `fileHash` 且文件可用，直接秒传成功。
- 若仅存在上传会话且未完成，返回已上传分片索引供续传。

### 13.3 服务端落盘策略
- 临时分片目录：`/uploads/kb/.chunks/{uploadId}/{chunkIndex}.part`
- 完整文件目录：`/uploads/kb/files/{userId}/{yyyyMMdd}/{safeFileName}`
- 合并前加文件锁，避免并发完成请求导致重复合并。

### 13.4 异常恢复策略
- 网络中断：客户端保存 `uploadId` 与本地分片进度，自动/手动恢复。
- 合并失败：保留分片并可重试 `complete`。
- 会话过期：返回明确错误码，前端提示重新初始化上传。

## 11. 风险与应对

- PDF 解析质量不稳定：保留原文预览与手动修正文档入口。
- 向量模型升级导致兼容问题：记录 embedding 版本，支持分批重建。
- 数据量增长变慢：启用 HNSW 索引与异步任务队列。

## 12. 与现有项目的集成清单

- 新增目录：
  - `server/api/rag/*`
  - `server/util/rag/*`
  - `app/pages/rag.vue`
  - `app/components/rag/*`
  - `app/composables/useRag.ts`
- 新增数据模型：`prisma/schema.prisma` 添加 `rag_document`、`rag_chunk`
- 新增脚本：
  - `pnpm rag:reindex`（全量重建）
  - `pnpm rag:check`（数据一致性检查）

---

该设计优先“先跑通、再优化”，可在你现有栈中最短路径落地，并且天然支持后续升级为企业级知识中台能力。
