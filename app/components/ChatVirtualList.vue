<template>
  <VirtualList
    ref="virtualListRef"
    :items="chatMessages"
    :item-height="120"
    :buffer-size="3"
    :scroll-to-bottom="shouldScrollToBottom"
    key-field="id"
    text-field="content"
    @scroll="handleScroll"
  >
    <template #default="{ item, index }">
      <div class="chat-message-wrapper">
        <ChatItem
          :is-user="item.isUser"
          :content="item.content"
          :class="[
            'mb-4',
            item.isUser ? 'ml-auto' : 'mr-auto'
          ]"
        />
      </div>
    </template>
  </VirtualList>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { ChatMessage } from '../../types/chat'

interface Props {
  messages: ChatMessage[]
  autoScroll?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoScroll: true
})

const virtualListRef = ref()
const shouldScrollToBottom = ref(false)

// 转换消息格式以适配虚拟列表
const chatMessages = computed(() => {
  return props.messages.map((message, index) => ({
    ...message,
    id: `msg-${Date.now()}-${index}`,
    index
  }))
})

// 监听新消息
watch(() => props.messages.length, (newLength, oldLength) => {
  if (newLength > oldLength && props.autoScroll) {
    shouldScrollToBottom.value = true
    nextTick(() => {
      virtualListRef.value?.scrollToBottom()
      shouldScrollToBottom.value = false
    })
  }
})

const handleScroll = (event: Event) => {
  // 可以在这里添加滚动监听逻辑
  // 比如判断是否滚动到底部等
}

// 暴露方法给父组件
defineExpose({
  scrollToBottom: () => {
    virtualListRef.value?.scrollToBottom()
  }
})
</script>

<style scoped>
.chat-message-wrapper {
  padding: 0 1rem;
}

:deep(.virtual-list-container) {
  height: 100%;
  overflow-y: auto;
}

:deep(.virtual-list-item) {
  padding: 0;
  border: none;
  background: transparent;
}
</style>