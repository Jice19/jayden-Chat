import type { Ref } from 'vue'

export type Theme = 'light' | 'dark'

export interface ThemeConfig {
  primary: string
  secondary: string
  background: string
  surface: string
  text: {
    primary: string
    secondary: string
    disabled: string
  }
  border: string
  hover: string
}

export const useTheme = () => {
  const theme: Ref<Theme> = ref('light')
  const systemTheme = ref<Theme>('light')
  
  // CSS变量主题配置
  const themes: Record<Theme, ThemeConfig> = {
    light: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      background: '#ffffff',
      surface: '#f9fafb',
      text: {
        primary: '#111827',
        secondary: '#6b7280',
        disabled: '#9ca3af'
      },
      border: '#e5e7eb',
      hover: '#f3f4f6'
    },
    dark: {
      primary: '#60a5fa',
      secondary: '#a78bfa',
      background: '#0f172a',
      surface: '#1e293b',
      text: {
        primary: '#f9fafb',
        secondary: '#d1d5db',
        disabled: '#9ca3af'
      },
      border: '#334155',
      hover: '#334155'
    }
  }
  
  // 初始化主题
  const initTheme = () => {
    // 获取系统主题
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    systemTheme.value = mediaQuery.matches ? 'dark' : 'light'
    
    // 获取保存的主题或系统主题
    const savedTheme = localStorage.getItem('theme') as Theme | null
    theme.value = savedTheme || systemTheme.value
    
    // 应用主题
    applyTheme(theme.value)
    
    // 监听系统主题变化
    mediaQuery.addEventListener('change', (e) => {
      systemTheme.value = e.matches ? 'dark' : 'light'
      // 如果用户没有手动设置过主题，跟随系统
      if (!localStorage.getItem('theme')) {
        applyTheme(systemTheme.value)
      }
    })
  }
  
  // 应用主题
  const applyTheme = (newTheme: Theme) => {
    const themeConfig = themes[newTheme]
    const root = document.documentElement
    
    // 设置CSS变量
    root.style.setProperty('--color-primary', themeConfig.primary)
    root.style.setProperty('--color-secondary', themeConfig.secondary)
    root.style.setProperty('--color-background', themeConfig.background)
    root.style.setProperty('--color-surface', themeConfig.surface)
    root.style.setProperty('--color-text-primary', themeConfig.text.primary)
    root.style.setProperty('--color-text-secondary', themeConfig.text.secondary)
    root.style.setProperty('--color-text-disabled', themeConfig.text.disabled)
    root.style.setProperty('--color-border', themeConfig.border)
    root.style.setProperty('--color-hover', themeConfig.hover)
    
    // 设置data属性用于CSS选择器
    root.setAttribute('data-theme', newTheme)
    
    theme.value = newTheme
  }
  
  // 切换主题
  const toggleTheme = () => {
    const newTheme = theme.value === 'light' ? 'dark' : 'light'
    applyTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }
  
  // 重置为系统主题
  const resetToSystemTheme = () => {
    localStorage.removeItem('theme')
    applyTheme(systemTheme.value)
  }
  
  return {
    theme: readonly(theme),
    systemTheme: readonly(systemTheme),
    initTheme,
    toggleTheme,
    resetToSystemTheme
  }
}