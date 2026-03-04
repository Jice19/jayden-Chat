<template>
  <VirtualList
    ref="virtualListRef"
    :items="chatMessages"
    :item-height="120"
    :buffer-size="3"
    key-field="id"
    text-field="content"
  >
    <template #default="{ item }">
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

// 转换消息格式，用稳定 id 避免 Date.now() 每次 computed 重算时变化
const chatMessages = computed(() => {
  return props.messages.map((message, index) => ({
    ...message,
    id: message.id || `msg-${index}`,
  }))
})

// 监听消息新增：有新消息时触底
watch(() => props.messages.length, (newLength, oldLength) => {
  if (!props.autoScroll || newLength <= oldLength) return
  nextTick(() => virtualListRef.value?.scrollToBottomIfAtBottom())
})

// 监听最后一条消息的内容变化：处理 AI 流式输出（length 不变，只有 content 追加）
// 只 deep watch 单个对象，不会产生 O(n) 开销
watch(
  () => props.messages[props.messages.length - 1]?.content,
  () => {
    if (!props.autoScroll) return
    virtualListRef.value?.scrollToBottomIfAtBottom()
  }
)

// 暴露方法给父组件
defineExpose({
  scrollToBottom: () => virtualListRef.value?.scrollToBottom()
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