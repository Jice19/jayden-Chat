<template>
  <div class="min-h-screen bg-gray-50 p-8">
    <div class="max-w-4xl mx-auto">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-4">虚拟列表演示</h1>
        <p class="text-gray-600 mb-6">
          这个演示展示了虚拟列表技术如何优化长列表的渲染性能。通过只渲染可视区域内的元素，
          我们可以处理包含数万个项目的列表而不会造成性能问题。
        </p>
        
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 class="text-lg font-semibold text-blue-900 mb-2">性能优化说明</h3>
          <ul class="text-blue-800 space-y-1">
            <li>• 只渲染可视区域内的元素（约15-20个）</li>
            <li>• 使用动态高度校正来准确计算滚动位置</li>
            <li>• 通过requestAnimationFrame优化滚动性能</li>
            <li>• 支持包含图片的复杂列表项</li>
          </ul>
        </div>
      </div>
      
      <VirtualListDemo />
      
      <div class="mt-8 bg-white rounded-lg shadow-sm border p-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">技术实现</h2>
        <div class="grid md:grid-cols-2 gap-6">
          <div>
            <h3 class="text-lg font-medium text-gray-800 mb-2">核心原理</h3>
            <ul class="text-gray-600 space-y-1">
              <li>• 使用绝对定位创建虚拟滚动容器</li>
              <li>• 通过transform实现内容偏移</li>
              <li>• 动态计算可视范围的起始索引</li>
              <li>• 使用二分查找优化索引计算</li>
            </ul>
          </div>
          <div>
            <h3 class="text-lg font-medium text-gray-800 mb-2">性能监控</h3>
            <ul class="text-gray-600 space-y-1">
              <li>• 实时FPS监控</li>
              <li>• 渲染元素数量统计</li>
              <li>• 滚动位置追踪</li>
              <li>• 内存使用优化</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 页面会自动导入VirtualListDemo组件
</script>