<template>
  <div :class="['mb-4', isUser ? 'flex justify-end' : 'flex justify-start']">
    <div 
      :class="[
        'p-3 rounded-lg max-w-full',
        isUser ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200'
      ]"
      v-html="renderedContent"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import Prism from 'prismjs'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-python'

const props = defineProps<{
  isUser: boolean
  content: string
}>()

const renderer = new marked.Renderer()
renderer.code = (code: string, language?: string) => {
  const lang = (language || '').toLowerCase()
  const grammar = Prism.languages[lang] || Prism.languages.markup
  const highlighted = Prism.highlight(code, grammar, lang || 'markup')
  const className = lang ? `language-${lang}` : 'language-markup'
  return `<pre class="${className}"><code class="${className}">${highlighted}</code></pre>`
}

const maxCacheSize = 200
const renderCache = new Map<string, string>()

const renderMarkdown = (content: string) => {
  const cached = renderCache.get(content)
  if (cached) {
    return cached
  }

  const html = marked.parse(content, {
    gfm: true,
    breaks: true,
    renderer
  }) as string

  renderCache.set(content, html)
  if (renderCache.size > maxCacheSize) {
    const firstKey = renderCache.keys().next().value
    if (firstKey) {
      renderCache.delete(firstKey)
    }
  }

  return html
}

const renderedContent = computed(() => renderMarkdown(props.content))
</script>
