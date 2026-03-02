# OpenSpec 使用指南

## 快速开始

OpenSpec 是一个轻量级的规范框架，帮助AI和人类开发者在编码前就需求达成一致。

## 核心命令

### 1. 提出新功能
```
/opsx:propose "添加深色模式支持"
```

### 2. 应用规范并开始开发
```
/opsx:apply
```

### 3. 归档完成的变更
```
/opsx:archive
```

## 当前项目状态

✅ **虚拟列表优化** - 已完成
- 创建了高性能虚拟列表组件
- 集成到主聊天界面
- 支持10000+数据项的流畅滚动

🔄 **待办事项**
- [ ] 测试虚拟列表在真实聊天数据下的表现
- [ ] 优化移动端响应式设计
- [ ] 添加更多性能监控指标

## 项目结构

```
jayden-Chat/
├── app/                    # Nuxt应用目录
│   ├── components/         # Vue组件
│   │   ├── VirtualList.vue # 通用虚拟列表组件
│   │   ├── ChatVirtualList.vue # 聊天专用虚拟列表
│   │   └── VirtualListDemo.vue # 演示组件
│   ├── pages/             # 页面
│   │   ├── index.vue      # 主聊天页面
│   │   └── virtual-list-demo.vue # 演示页面
│   └── composables/       # 组合式函数
├── openspec/              # OpenSpec配置
│   └── config.json       # 项目配置
├── prisma/               # 数据库模型
├── server/               # 服务端API
└── types/                # TypeScript类型定义
```

## 技术栈

- **前端**: Nuxt 4, Vue 3, TypeScript, Tailwind CSS
- **后端**: Prisma, PostgreSQL
- **AI服务**: 阿里云通义千问API
- **性能优化**: 虚拟列表, RequestAnimationFrame