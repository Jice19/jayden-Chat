# 基于 Nuxt4 + PostgreSQL + 通义千问的智能聊天机器人
一个轻量级智能聊天应用，整合 Nuxt4 全栈框架、PostgreSQL 数据库和阿里云通义千问大模型，实现「上下文记忆+消息持久化+AI 智能回复」的核心功能，复刻极简版豆包对话体验。

## 📋 项目概述
### 核心目标
- 实现前端对话界面与后端接口的完整联动
- 接入阿里云通义千问大模型，支持智能语义回复
- 基于 PostgreSQL 实现对话消息持久化存储
- 增加上下文记忆功能，让 AI 记住历史对话内容
- 遵循安全最佳实践，保护 API Key 不泄露

### 技术栈
| 技术/工具                | 用途说明                     |
|--------------------------|------------------------------|
| Nuxt 4 (Vue 3)           | 前端界面 + 服务端接口开发    |
| TypeScript               | 类型安全的代码开发           |
| PostgreSQL               | 对话消息持久化存储           |
| Prisma ORM               | 数据库模型管理与操作         |
| 阿里云通义千问 (Qwen)    | 大模型智能回复能力           |
| PNPM                     | 包管理工具                   |
| Tailwind CSS             | 轻量级样式框架（界面布局）   |

## 🚀 快速开始
### 前置条件
1. 操作系统：macOS（适配 Homebrew 环境）
2. 环境依赖：Node.js (v18+)、PNPM、PostgreSQL
3. 阿里云账号：已开通通义千问 API 并获取 API Key

### 环境配置
#### 1. 全局环境变量配置（MacOS）
```bash
# 编辑全局环境变量配置文件
nano ~/.zshrc

# 添加以下内容（替换为你的真实 API Key）
export ALIYUN_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 使配置生效
source ~/.zshrc

# 验证配置（能输出 API Key 即成功）
echo $ALIYUN_API_KEY
```

#### 2. 数据库配置
```bash
# 启动 PostgreSQL 服务（Homebrew 安装）
brew services start postgresql

# 创建项目数据库
createdb -U $USER doubao_db
```

### 项目启动
#### 1. 克隆/下载项目
```bash
git clone <你的项目仓库地址>
cd nuxt-app
```

#### 2. 安装依赖
```bash
pnpm install
```

#### 3. 数据库初始化
```bash
# 生成 Prisma 客户端
npx prisma generate

# 执行数据库迁移（创建 Chat 表）
npx prisma migrate dev --name init
```

#### 4. 启动开发服务
```bash
pnpm dev
```

#### 5. 访问应用
打开浏览器访问：`http://localhost:3000`

## 📁 核心功能说明
### 1. 基础对话
- 前端输入框支持文本输入，按回车/点击发送按钮提交消息
- 自动区分用户/AI 消息样式，用户消息右对齐（蓝色），AI 消息左对齐（白色）
- 消息发送后显示「正在思考中」加载状态，提升交互体验

### 2. 消息持久化
- 所有对话消息自动存入 PostgreSQL 的 `Chat` 表
- 页面刷新后自动加载历史对话记录
- 支持多会话隔离（通过 `sessionId` 区分）

### 3. 上下文记忆
- AI 可记住最近 5 轮对话内容，支持上下文关联回复
- 例如：先发送「我叫小明」，再问「我叫什么」，AI 能正确回答

### 4. 安全防护
- API Key 仅在服务端调用，前端无敏感信息暴露
- 全局环境变量存储 API Key，避免硬编码泄露
- 接口层添加参数校验，防止空消息/非法请求

## 🔧 项目结构（核心文件）
```
nuxt-app/
├── app/
│   └── app.vue               # 前端聊天界面（核心）
├── prisma/
│   ├── schema.prisma         # 数据库模型定义（Chat 表）
│   └── migrations/           # 数据库迁移文件
├── server/
│   ├── api/
│   │   ├── chat/
│   │   │   ├── save.post.ts  # 保存消息接口
│   │   │   ├── list.get.ts   # 获取历史消息接口
│   │   │   └── ai-reply.post.ts # AI 回复接口
│   └── utils/
│       ├── aliyun-ai.ts      # 通义千问 API 封装
│       └── chat-context.ts   # 上下文记忆工具
├── nuxt.config.ts            # Nuxt 配置（环境变量读取）
└── package.json              # 项目依赖与脚本
```

## ⚠️ 常见问题
1. **PostgreSQL 启动失败**：
   ```bash
   # 重启 PostgreSQL 服务
   brew services restart postgresql
   ```
2. **API Key 读取为 null**：
   - 确保全局环境变量配置后重启终端
   - 确认 Nuxt 服务在配置环境变量后的终端启动
3. **AI 回复为空**：
   - 检查 API Key 额度是否充足
   - 确认模型名称为 `qwen-plus` 或 `qwen-turbo`
4. **上下文记忆不生效**：
   - 检查 `chat-context.ts` 中 `maxRound` 配置（默认 5 轮）
   - 确认消息保存时传递了 `sessionId`

## 📌 后续优化方向
- [ ] 支持流式回复（AI 打字机效果）
- [ ] 增加会话管理（新建/切换/删除会话）
- [ ] 接入文生图功能
- [ ] 添加消息撤回/编辑功能
- [ ] 优化移动端适配体验

## 📄 许可证
本项目为学习用途开发，可自由修改和扩展，使用时请遵守阿里云 API 使用规范和 PostgreSQL 开源协议。