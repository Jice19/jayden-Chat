<template>
  <div class="virtual-list">
    <div 
      ref="containerRef"
      class="virtual-list-container"
      @scroll="handleScroll"
      @wheel="handleUserScrollStart"
      @touchstart="handleUserScrollStart"
      @touchend="handleUserScrollEnd"
      @mousedown="handleUserScrollStart"
      @mouseup="handleUserScrollEnd"
    >
      <div 
        class="virtual-list-phantom"
        :style="{ height: totalHeight + 'px' }"
      ></div>
      
      <div 
        class="virtual-list-content"
        :style="{ transform: `translateY(${offsetY}px)` }"
      >
        <div
          v-for="{ item, index } in visibleData"
          :key="getItemKey(item)"
          class="virtual-list-item"
          :data-index="index"
          :ref="setItemRef"
        >
          <slot :item="item" :index="index">
            {{ getItemText(item) }}
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'

interface VirtualListProps<T> {
  items: T[]
  itemHeight: number
  bufferSize?: number
  keyField?: string
  textField?: string
  scrollToBottom?: boolean
}

interface Position {
  index: number
  height: number
  top: number
  bottom: number
}

const props = withDefaults(defineProps<VirtualListProps<T>>(), {
  bufferSize: 5,
  keyField: 'id',
  textField: 'text',
  scrollToBottom: false
})

const emit = defineEmits<{
  scroll: [event: Event]
}>()

// 状态
const containerRef = ref<HTMLElement>()
const itemRefs = new Map<number, HTMLElement>()
const scrollTop = ref(0)
const containerHeight = ref(0)
const startIndex = ref(0)
const positions = ref<Position[]>([])
const isAtBottom = ref(true) // 是否在底部
const userScrolling = ref(false) // 用户是否正在手动滚动

// ResizeObserver 用于监听元素高度变化
let resizeObserver: ResizeObserver | null = null

// 设置 ref 的辅助函数
const setItemRef = (el: any) => {
  if (el) {
    const index = parseInt(el.dataset.index)
    itemRefs.set(index, el)
    resizeObserver?.observe(el)
  }
}

// 检查是否在底部（传入已读取的值，避免二次强制布局）
const checkAtBottom = (scrollTopVal: number, scrollHeightVal: number, clientHeightVal: number) => {
  isAtBottom.value = Math.abs(scrollHeightVal - scrollTopVal - clientHeightVal) < 20
}

// 获取项目key
const getItemKey = (item: T): string => {
  return String((item as any)[props.keyField] || '')
}

// 获取项目文本
const getItemText = (item: T): string => {
  return String((item as any)[props.textField] || '')
}

const initPositions = () => {
  positions.value = props.items.map((_, index) => ({
    index,
    height: props.itemHeight,
    top: index * props.itemHeight,
    bottom: (index + 1) * props.itemHeight,
  }))
}

// 二分查找起始索引
const getStartIndex = (scrollTop: number): number => {
  if (!positions.value || positions.value.length === 0) return 0
  
  let start = 0
  let end = positions.value.length - 1
  let tempIndex = 0

  while (start <= end) {
    const midIndex = Math.floor((start + end) / 2)
    const midVal = positions.value[midIndex]?.bottom ?? 0

    if (midVal === scrollTop) {
      return midIndex + 1
    } else if (midVal < scrollTop) {
      start = midIndex + 1
    } else if (midVal > scrollTop) {
      tempIndex = midIndex
      end = midIndex - 1
    }
  }
  return tempIndex
}

// 计算属性
const totalHeight = computed(() => {
  return positions.value && positions.value.length > 0 
    ? positions.value[positions.value.length - 1]?.bottom ?? 0
    : 0
})

const visibleCount = computed(() => {
  return Math.ceil(containerHeight.value / props.itemHeight)
})

const visibleRange = computed(() => {
  const visibleCountValue = visibleCount.value
  const start = Math.max(0, startIndex.value - props.bufferSize)
  const end = Math.min(props.items.length - 1, startIndex.value + visibleCountValue + props.bufferSize)
  return { start, end }
})

const visibleData = computed<{ item: T; index: number }[]>(() => {
  const { start, end } = visibleRange.value
  return props.items.slice(start, end + 1).map((item, i) => ({ item, index: start + i }))
})

const offsetY = computed(() => {
  return visibleRange.value.start >= 0 && positions.value && visibleRange.value.start < positions.value.length
    ? positions.value[visibleRange.value.start]?.top ?? 0
    : 0
})

// 更新位置信息
const updatePositions = (index: number, height: number) => {
  if (!positions.value[index]) return
  
  const oldHeight = positions.value[index].height
  const diff = height - oldHeight
  
  if (diff !== 0) {
    positions.value[index].height = height
    positions.value[index].bottom = positions.value[index].top + height
    
    // 更新后续所有节点
    for (let i = index + 1; i < positions.value.length; i++) {
      const prev = positions.value[i - 1]
      const current = positions.value[i]
      if (prev && current) {
        current.top = prev.bottom
        current.bottom = current.top + current.height
      }
    }

    // 智能追踪：如果之前在底部，且不是用户在滚动，则校正高度后继续触底
    if (isAtBottom.value && !userScrolling.value) {
      scrollToBottom()
    }
  }
}

// 滚动处理
const handleScroll = (event: Event) => {
  const container = containerRef.value
  if (!container) return

  // 一次性批量读取所有 DOM 属性，避免多次强制布局
  const { scrollTop: st, scrollHeight: sh, clientHeight: ch } = container

  scrollTop.value = st
  containerHeight.value = ch
  startIndex.value = getStartIndex(st)
  checkAtBottom(st, sh, ch)
  emit('scroll', event)
}

// 用户干预滚动的处理
let scrollEndTimer: ReturnType<typeof setTimeout> | null = null
const handleUserScrollStart = () => {
  userScrolling.value = true
  if (scrollEndTimer) clearTimeout(scrollEndTimer)
  scrollEndTimer = setTimeout(() => {
    userScrolling.value = false
    const c = containerRef.value
    if (c) checkAtBottom(c.scrollTop, c.scrollHeight, c.clientHeight)
  }, 200)
}

const handleUserScrollEnd = () => {
  if (scrollEndTimer) clearTimeout(scrollEndTimer)
  scrollEndTimer = setTimeout(() => {
    userScrolling.value = false
    const c = containerRef.value
    if (c) checkAtBottom(c.scrollTop, c.scrollHeight, c.clientHeight)
  }, 150)
}

// 滚动到底部
const scrollToBottom = () => {
  // 乐观标记在底部：让 ResizeObserver 在 scroll 事件到达之前就能持续追踪
  // 否则 nextTick+rAF 异步期间 isAtBottom 仍为 false，流式输出会脱轨
  isAtBottom.value = true
  nextTick(() => {
    if (containerRef.value) {
      requestAnimationFrame(() => {
        if (containerRef.value) {
          containerRef.value.scrollTop = containerRef.value.scrollHeight
        }
      })
    }
  })
}

// 仅监听 length 变化，避免 deep watch 对每次消息内容更新做 O(n) 深度比较
watch(() => props.items.length, (newLen, oldLen) => {
  if (newLen > oldLen) {
    // 增量更新 positions
    for (let i = oldLen; i < newLen; i++) {
      const prevBottom = i > 0 ? (positions.value[i - 1]?.bottom || 0) : 0
      positions.value[i] = {
        index: i,
        height: props.itemHeight,
        top: prevBottom,
        bottom: prevBottom + props.itemHeight
      }
    }
  } else if (newLen < oldLen) {
    // 数据减少，重新初始化
    itemRefs.clear()
    initPositions()
  }

  // 智能追踪：如果之前在底部，自动触底
  if (isAtBottom.value && !userScrolling.value) {
    scrollToBottom()
  }
})

// 暴露方法
defineExpose({
  scrollToBottom,
  scrollToBottomIfAtBottom: () => {
    if (isAtBottom.value && !userScrolling.value) {
      scrollToBottom()
    }
  }
})

onMounted(() => {
  initPositions()
  containerHeight.value = containerRef.value?.clientHeight ?? 0
  
  // 初始化 ResizeObserver
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const index = parseInt((entry.target as HTMLElement).dataset.index || '-1')
      if (index !== -1) {
        // 获取实际高度，这里使用 contentRect.height 或者 borderBoxSize
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
        updatePositions(index, height)
      }
    }
  })

  if (props.scrollToBottom && props.items.length > 0) {
    scrollToBottom()
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  if (scrollEndTimer) clearTimeout(scrollEndTimer)
  itemRefs.clear()
})
</script>

<style scoped>
.virtual-list {
  width: 100%;
  height: 100%;
  position: relative;
}

.virtual-list-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  position: relative;
  -webkit-overflow-scrolling: touch;
  will-change: transform;
}

.virtual-list-phantom {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: -1;
}

.virtual-list-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
}

.virtual-list-item {
  position: relative;
  box-sizing: border-box;
}
</style>