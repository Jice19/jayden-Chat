<template>
  <div v-if="isVisible" class="fixed inset-0 bg-gray-200 bg-opacity-75 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ title }}</h3>
      <p class="text-gray-700 dark:text-gray-300 mb-6">{{ message }}</p>
      <div class="flex justify-end space-x-3">
        <button
          @click="cancel"
          class="px-4 py-2 rounded-md text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          {{ cancelButtonText }}
        </button>
        <button
          @click="confirm"
          class="px-4 py-2 rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors"
        >
          {{ confirmButtonText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  title?: string
  message?: string
  confirmButtonText?: string
  cancelButtonText?: string
}>(), {
  title: '确认操作',
  message: '您确定要执行此操作吗？',
  confirmButtonText: '确定',
  cancelButtonText: '取消'
})

const isVisible = ref(false)
let resolvePromise: ((value: boolean) => void) | null = null

const show = (): Promise<boolean> => {
  isVisible.value = true
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

const confirm = () => {
  isVisible.value = false
  if (resolvePromise) {
    resolvePromise(true)
  }
}

const cancel = () => {
  isVisible.value = false
  if (resolvePromise) {
    resolvePromise(false)
  }
}

defineExpose({
  show
})
</script>
