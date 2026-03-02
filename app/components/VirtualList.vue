<template>
  <div class="virtual-list">
    <div 
      ref="containerRef"
      class="virtual-list-container"
      @scroll="handleScroll"
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
          v-for="item in visibleData"
          :key="getItemKey(item)"
          class="virtual-list-item"
          :data-index="getItemIndex(item)"
          ref="itemRefs"
        >
          <slot :item="item" :index="getItemIndex(item)">
            {{ getItemText(item) }}
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { ref, computed, onMounted, nextTick, watch } from 'vue'

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
const itemRefs = ref<HTMLElement[]>([])
const scrollTop = ref(0)
const containerHeight = ref(0)
const startIndex = ref(0)
const positions = ref<Position[]>([])

// 获取项目key
const getItemKey = (item: T): string => {
  return String((item as any)[props.keyField] || '')
}

// 获取项目索引
const getItemIndex = (item: T): number => {
  return props.items.indexOf(item)
}

// 获取项目文本
const getItemText = (item: T): string => {
  return String((item as any)[props.textField] || '')
}

// 初始化位置数据
const initPositions = () => {
  positions.value = props.items.map((_, index) => ({
    index,
    height: props.itemHeight,
    top: index * props.itemHeight,
    bottom: (index + 1) * props.itemHeight
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

const visibleData = computed(() => {
  const { start, end } = visibleRange.value
  return props.items.slice(start, end + 1)
})

const offsetY = computed(() => {
  return visibleRange.value.start >= 0 && positions.value && visibleRange.value.start < positions.value.length
    ? positions.value[visibleRange.value.start]?.top ?? 0
    : 0
})

// 更新位置（动态高度校正）
const updatePositions = () => {
  nextTick(() => {
    const nodes = itemRefs.value
    if (!nodes || nodes.length === 0) return

    let diff = 0
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (!node) continue
      
      const index = parseInt(node.dataset?.index || '0')
      const rect = node.getBoundingClientRect()
      const realHeight = rect.height
      
      if (positions.value && positions.value[index]) {
        const oldHeight = positions.value[index].height
        const value = realHeight - oldHeight

        if (value !== 0) {
          positions.value[index].height = realHeight
          diff += value
        }
      }
    }

    if (diff !== 0 && positions.value) {
      const start = visibleRange.value.start
      for (let i = start + nodes.length; i < positions.value.length; i++) {
        if (positions.value[i]) {
          positions.value[i].top += diff
          positions.value[i].bottom += diff
        }
      }
    }
  })
}

// 滚动处理
const handleScroll = (event: Event) => {
  requestAnimationFrame(() => {
    const scrollTopValue = containerRef.value?.scrollTop ?? 0
    const containerHeightValue = containerRef.value?.clientHeight ?? 0
    
    scrollTop.value = scrollTopValue
    containerHeight.value = containerHeightValue
    
    startIndex.value = getStartIndex(scrollTopValue)
    
    updatePositions()
    emit('scroll', event)
  })
}

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (containerRef.value) {
      containerRef.value.scrollTop = totalHeight.value
    }
  })
}

// 监听数据变化
watch(() => props.items, () => {
  initPositions()
  if (props.scrollToBottom) {
    scrollToBottom()
  }
}, { deep: true })

// 生命周期
onMounted(() => {
  initPositions()
  containerHeight.value = containerRef.value?.clientHeight ?? 0
  
  if (props.scrollToBottom && props.items.length > 0) {
    scrollToBottom()
  }
})

// 暴露方法
defineExpose({
  scrollToBottom
})
</script>

<style scoped>
.virtual-list {
  width: 100%;
  height: 100%;
}

.virtual-list-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  position: relative;
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
}

.virtual-list-item {
  position: relative;
}
</style>