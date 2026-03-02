# 深色模式技术设计

## 架构设计

### 1. 主题管理架构
```
useTheme.ts (主题管理Composable)
    ↓
ThemeProvider.vue (主题提供者组件)
    ↓
各业务组件 (自动响应主题变化)
```

### 2. 技术实现方案

#### CSS变量定义
```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f3f4f6;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --border-color: #e5e7eb;
}

[data-theme="dark"] {
  --bg-primary: #1f2937;
  --bg-secondary: #111827;
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --border-color: #374151;
}
```

#### Composable设计
```typescript
// useTheme.ts
export const useTheme = () => {
  const theme = ref<'light' | 'dark'>('light')
  
  // 初始化主题
  const initTheme = () => {
    const saved = localStorage.getItem('theme')
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    theme.value = saved ? saved as 'light' | 'dark' : (systemDark ? 'dark' : 'light')
    applyTheme(theme.value)
  }
  
  // 应用主题
  const applyTheme = (newTheme: 'light' | 'dark') => {
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('theme', newTheme)
    theme.value = newTheme
  }
  
  // 切换主题
  const toggleTheme = () => {
    applyTheme(theme.value === 'light' ? 'dark' : 'light')
  }
  
  return { theme, initTheme, toggleTheme }
}
```

### 3. 组件适配方案

#### 全局主题监听
```typescript
// 在app.vue或布局组件中
const { theme, initTheme } = useTheme()

onMounted(() => {
  initTheme()
  
  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      applyTheme(e.matches ? 'dark' : 'light')
    }
  })
})
```

#### 主题切换按钮
```vue
<template>
  <button @click="toggleTheme" class="theme-toggle">
    <span v-if="theme === 'light'">🌙</span>
    <span v-else>☀️</span>
  </button>
</template>
```

## 性能考虑
- 使用CSS变量避免重复渲染
- 主题切换时只更新必要的DOM属性
- 平滑过渡使用CSS transition

## 兼容性方案
- 使用Tailwind的dark:前缀类名作为备选方案
- 检测浏览器对CSS变量的支持
- 提供降级方案