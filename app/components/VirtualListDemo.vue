<template>
  <div class="virtual-list-container">
    <div class="virtual-list-header">
      <h3>虚拟列表演示</h3>
      <div class="virtual-list-stats">
        <span>渲染: {{ visibleCount }} 项</span>
        <span>FPS: {{ fps }}</span>
        <span>起始索引: {{ startIndex }}</span>
      </div>
    </div>
    
    <div 
      ref="containerRef"
      class="virtual-list-viewport"
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
          :key="item.id"
          class="virtual-list-item"
          :data-index="item.id"
          ref="itemRefs"
        >
          <div class="item-head">
            <span class="item-title">#{{ item.id }}</span>
            <span class="item-position">pos: {{ getItemPosition(item.id) }}px</span>
          </div>
          <div class="item-text">{{ item.text }}</div>
          <div 
            v-if="item.hasImage"
            class="item-image"
            :style="{ height: item.imgHeight + 'px' }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'

interface VirtualListItem {
  id: number
  text: string
  hasImage: boolean
  imgHeight: number
}

interface Position {
  index: number
  height: number
  top: number
  bottom: number
  value: number
}

// 配置
const TOTAL_COUNT = 10000
const ESTIMATED_HEIGHT = 80
const BUFFER_SIZE = 5

// 状态
const containerRef = ref<HTMLElement>()
const itemRefs = ref<HTMLElement[]>([])
const scrollTop = ref(0)
const containerHeight = ref(0)
const startIndex = ref(0)
const fps = ref(0)

// 数据
const data = ref<VirtualListItem[]>([])
const positions = ref<Position[]>([])

// 生成随机文本
function getRandomText() {
  const str = "性能优化是一个系统工程涉及渲染原理算法多线程计算等核心知识点"
  const len = Math.floor(Math.random() * 100) + 10
  let res = ""
  for(let i = 0; i < len; i++) {
    res += str[Math.floor(Math.random() * str.length)]
  }
  return res
}

// 初始化数据
function initData() {
  for (let i = 0; i < TOTAL_COUNT; i++) {
    data.value.push({
      id: i,
      text: getRandomText(),
      hasImage: Math.random() > 0.7,
      imgHeight: Math.floor(Math.random() * 100) + 50
    })
  }
}

// 初始化位置数据
function initPositions() {
  positions.value = data.value.map((_, index) => ({
    index,
    height: ESTIMATED_HEIGHT,
    top: index * ESTIMATED_HEIGHT,
    bottom: (index + 1) * ESTIMATED_HEIGHT,
    value: 0
  }))
}

// 二分查找起始索引
function getStartIndex(scrollTop: number): number {
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
    ? positions.value[positions.value.length - 1].bottom 
    : 0
})

const visibleCount = computed(() => {
  return Math.ceil(containerHeight.value / ESTIMATED_HEIGHT)
})

const visibleRange = computed(() => {
  const visibleCountValue = visibleCount.value
  const start = Math.max(0, startIndex.value - BUFFER_SIZE)
  const end = Math.min(data.value.length - 1, startIndex.value + visibleCountValue + BUFFER_SIZE)
  return { start, end }
})

const visibleData = computed(() => {
  const { start, end } = visibleRange.value
  return data.value.slice(start, end + 1)
})

const offsetY = computed(() => {
  return visibleRange.value.start >= 0 && positions.value && visibleRange.value.start < positions.value.length
    ? positions.value[visibleRange.value.start].top
    : 0
})

const getItemPosition = (id: number) => {
  return (positions.value && positions.value[id]?.top) ?? 0
}

// 更新位置
function updatePositions() {
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
          positions.value[index].value = value
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

// 渲染函数
function render() {
  const scrollTopValue = containerRef.value?.scrollTop ?? 0
  const containerHeightValue = containerRef.value?.clientHeight ?? 0
  
  scrollTop.value = scrollTopValue
  containerHeight.value = containerHeightValue
  
  startIndex.value = getStartIndex(scrollTopValue)
  
  updatePositions()
}

// 滚动处理
function handleScroll() {
  requestAnimationFrame(() => {
    render()
  })
}

// FPS计算
let lastTime = 0
let frameCount = 0

function calculateFPS() {
  const now = performance.now()
  frameCount++

  if (now - lastTime >= 1000) {
    fps.value = frameCount
    frameCount = 0
    lastTime = now
  }
  requestAnimationFrame(calculateFPS)
}

// 生命周期
onMounted(() => {
  initData()
  initPositions()
  containerHeight.value = containerRef.value?.clientHeight ?? 0
  calculateFPS()
})
</script>

<style scoped>
.virtual-list-container {
  width: 100%;
  height: 600px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.virtual-list-header {
  padding: 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.virtual-list-stats {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #666;
}

.virtual-list-viewport {
  flex: 1;
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
  padding: 16px;
  border-bottom: 1px solid #eee;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.item-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.item-title {
  font-size: 16px;
  color: #333;
  font-weight: 500;
}

.item-position {
  font-size: 12px;
  color: #999;
}

.item-text {
  color: #666;
  line-height: 1.5;
  margin-bottom: 8px;
}

.item-image {
  background: #f0f0f0;
  border-radius: 4px;
  margin-top: 8px;
}
</style>