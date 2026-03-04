<template>
  <!-- 遮罩层 -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="showLoginModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" @click.stop>

          <!-- 顶部品牌区 -->
          <div class="bg-gradient-to-br from-blue-600 to-purple-600 px-8 pt-8 pb-6 text-white text-center">
            <div class="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg viewBox="0 0 24 24" class="w-8 h-8 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 10.975V8a2 2 0 0 0-2-2h-6V4.688c.305-.274.5-.668.5-1.11a1.5 1.5 0 0 0-3 0c0 .442.195.836.5 1.11V6H5a2 2 0 0 0-2 2v2.975A2 2 0 0 0 2 13v2a2 2 0 0 0 1 1.723V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2.277A2 2 0 0 0 22 15v-2a2 2 0 0 0-1-1.025zM9 9.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-3 7.5c-1.813 0-3.35-.994-3.822-2.35a.5.5 0 0 1 .95-.3C9.516 15.344 10.653 16 12 16s2.484-.656 2.872-1.65a.5.5 0 1 1 .95.3C15.35 16.006 13.813 17 12 17z"/>
              </svg>
            </div>
            <h1 class="text-xl font-bold">jayden-Chat</h1>
            <p class="text-sm text-white/70 mt-1">{{ isRegister ? '创建你的账号' : '欢迎回来' }}</p>
          </div>

          <!-- 表单区 -->
          <div class="px-8 py-6 space-y-4">
            <!-- Tab 切换 -->
            <div class="flex rounded-xl bg-gray-100 p-1 gap-1">
              <button
                class="flex-1 py-1.5 text-sm font-medium rounded-lg transition-all"
                :class="!isRegister ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'"
                @click="isRegister = false; clearError()"
              >登录</button>
              <button
                class="flex-1 py-1.5 text-sm font-medium rounded-lg transition-all"
                :class="isRegister ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'"
                @click="isRegister = true; clearError()"
              >注册</button>
            </div>

            <!-- 用户名 -->
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1.5">用户名</label>
              <input
                v-model="username"
                type="text"
                placeholder="请输入用户名"
                maxlength="20"
                autocomplete="username"
                class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                :class="{ 'border-red-300': errorMsg }"
                @keydown.enter="onSubmit"
              />
            </div>

            <!-- 密码 -->
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1.5">密码</label>
              <div class="relative">
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="请输入密码"
                  maxlength="50"
                  autocomplete="current-password"
                  class="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  :class="{ 'border-red-300': errorMsg }"
                  @keydown.enter="onSubmit"
                />
                <button
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  @click="showPassword = !showPassword"
                >
                  <svg v-if="showPassword" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                  <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- 错误提示 -->
            <p v-if="errorMsg" class="text-xs text-red-500 flex items-center gap-1">
              <svg class="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              {{ errorMsg }}
            </p>

            <!-- 提交按钮 -->
            <button
              class="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              :disabled="loading"
              @click="onSubmit"
            >
              <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {{ loading ? '请稍候...' : (isRegister ? '注册' : '登录') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '~/composables/useAuth'

const { showLoginModal, errorMsg, loading, login, register } = useAuth()

const isRegister = ref(false)
const username = ref('')
const password = ref('')
const showPassword = ref(false)

const clearError = () => { errorMsg.value = '' }

const onSubmit = async () => {
  if (!username.value.trim() || !password.value) {
    errorMsg.value = '请填写用户名和密码'
    return
  }
  if (isRegister.value) {
    await register(username.value.trim(), password.value)
  } else {
    await login(username.value.trim(), password.value)
  }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.fade-enter-active .bg-white,
.fade-leave-active .bg-white {
  transition: transform 0.2s ease;
}
.fade-enter-from .bg-white {
  transform: scale(0.95);
}
</style>
