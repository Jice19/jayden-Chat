<template>
  <div class="min-h-screen transition-colors duration-300" :class="themeClass">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <LoginModal />
  </div>
</template>

<script setup lang="ts">
import LoginModal from '~/components/LoginModal.vue'
import { useAuth } from '~/composables/useAuth'

const { initTheme } = useTheme()
const { restoreSession } = useAuth()

onMounted(async () => {
  initTheme()
  await restoreSession()
})

// 计算主题类名
const themeClass = computed(() => {
  return 'theme-' + (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') || 'light' : 'light')
})
</script>

<style>
@import "./assets/dark-mode.css";

/* 基础主题变量 */
:root {
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  --color-background: #ffffff;
  --color-surface: #f9fafb;
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-text-disabled: #9ca3af;
  --color-border: #e5e7eb;
  --color-hover: #f3f4f6;
}

[data-theme="dark"] {
  --color-primary: #60a5fa;
  --color-secondary: #a78bfa;
  --color-background: #0f172a;
  --color-surface: #1e293b;
  --color-text-primary: #f9fafb;
  --color-text-secondary: #d1d5db;
  --color-text-disabled: #9ca3af;
  --color-border: #334155;
  --color-hover: #334155;
}

/* 过渡动画 */
* {
  transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
}
</style>