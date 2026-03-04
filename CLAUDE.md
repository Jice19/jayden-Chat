# CLAUDE.md — jayden-Chat 项目指南

## 项目概述

基于 **Nuxt 4 + PostgreSQL + 通义千问** 的全栈智能聊天机器人。

- **前端**: Nuxt 4 (Vue 3) + TypeScript + Tailwind CSS 4
- **后端**: Nuxt Server API (Nitro)
- **数据库**: PostgreSQL + Prisma ORM
- **AI**: 阿里云通义千问 (Qwen)
- **包管理器**: pnpm

---

## 快速启动

```bash
# 设置 API Key（每次新终端都需要）
export ALIYUN_API_KEY="sk-..."

# 启动 PostgreSQL
brew services start postgresql

# 安装依赖
pnpm install

# 初始化数据库（首次）
npx prisma migrate dev --name init

# 启动开发服务器
pnpm dev
# 访问 http://localhost:3000
```

### 常用命令

```bash
pnpm dev          # 开发服务器
pnpm build        # 生产构建
pnpm preview      # 预览生产版本

npx prisma studio      # 可视化数据库编辑器
npx prisma db push     # 同步 schema（无 migration）
npx prisma generate    # 重新生成 Prisma client
```

---

## 目录结构

```
jayden-Chat/
├── app/
│   ├── app.vue                  # 根组件，主题管理
│   ├── components/              # Vue 组件
│   │   ├── ChatVirtualList.vue  # 聊天虚拟滚动列表
│   │   ├── VirtualList.vue      # 通用虚拟列表组件
│   │   ├── ChatItem.vue         # 单条消息组件
│   │   ├── MarkdownRenderer.ts  # Markdown 渲染
│   │   ├── ThemeToggle.vue      # 深色/浅色切换
│   │   ├── ConfirmModal.vue     # 确认弹窗
│   │   └── CodeBlock.vue        # 代码块渲染
│   ├── pages/
│   │   └── index.vue            # 主聊天页面
│   ├── composables/
│   │   ├── useChat.ts           # 聊天核心逻辑与状态
│   │   ├── useApi.ts            # Axios 封装
│   │   └── useTheme.ts          # 主题管理
│   ├── plugins/
│   │   └── axios.ts             # Axios 插件（baseURL=/api）
│   ├── utils/
│   │   └── request.ts           # HTTP 请求配置
│   └── assets/
│       ├── main.css             # 主样式
│       └── dark-mode.css        # 深色模式样式
├── server/
│   ├── api/
│   │   ├── chat/
│   │   │   ├── save.post.ts     # 保存消息
│   │   │   ├── list.get.ts      # 获取聊天历史
│   │   │   └── ai-reply.post.ts # AI 流式回复
│   │   └── session/
│   │       ├── create.post.ts
│   │       ├── list.get.ts
│   │       └── [sessionId].delete.ts
│   └── util/
│       └── aliyun-ai.ts         # 通义千问 API 封装
├── prisma/
│   ├── schema.prisma            # 数据模型：Session, Chat
│   └── migrations/
├── types/                       # TypeScript 类型定义
│   ├── chat.ts
│   └── api.ts
└── openspec/                    # 功能设计文档
```

---

## 数据库 Schema

```prisma
model Session {
  id        String   @id @default(cuid())
  title     String
  createdAt DateTime @default(now())
  chats     Chat[]
}

model Chat {
  id        String   @id @default(cuid())
  content   String
  isUser    Boolean
  createdAt DateTime @default(now())
  sessionId String?
  session   Session? @relation(fields: [sessionId], references: [id])
}
```

数据库连接：`postgresql://jayden:123456@localhost:5432/doubao_db`

---

## 关键架构

### AI 流式回复
- 使用 SSE（Server-Sent Events）实现实时流式输出
- 依赖 `@microsoft/fetch-event-source`
- 服务端：`server/api/chat/ai-reply.post.ts`
- AI 封装：`server/util/aliyun-ai.ts`（temperature=0.7, max_tokens=2000）
- 上下文记忆：取最近 20 条消息

### 虚拟滚动
- 长对话列表性能优化，仅渲染可视区 15-20 条消息
- `VirtualList.vue` — 通用虚拟滚动实现
- `ChatVirtualList.vue` — 聊天场景封装

### 主题系统
- CSS 变量驱动，支持浅色/深色模式
- 偏好持久化到 localStorage
- `useTheme.ts` composable

### 安全
- `ALIYUN_API_KEY` 仅存于服务端 Nuxt runtime config
- 永不暴露给客户端 JavaScript

---

## 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `ALIYUN_API_KEY` | 阿里云通义千问 API Key | 是 |

---

## 常见问题

| 问题 | 解决方案 |
|------|---------|
| PostgreSQL 启动失败 | `brew services restart postgresql` |
| API Key 为 null | 确认环境变量已设置，重启终端 |
| AI 回复为空 | 检查 API 配额和模型名称 |
| 上下文记忆不生效 | 检查 `aliyun-ai.ts` 中 maxRound 配置（默认 20） |

---

## 代码规范

- 使用 TypeScript，类型定义在 `types/` 目录
- 状态管理通过 Composables（`app/composables/`）
- API 端点遵循 Nuxt 文件路由约定（`.get.ts`, `.post.ts`, `.delete.ts`）
- 样式优先使用 Tailwind CSS 工具类
- 深色模式通过 CSS 变量 + `data-theme` attribute 实现
