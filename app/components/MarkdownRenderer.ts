import { defineComponent, h, type PropType, computed } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css' // 默认亮色主题
import 'highlight.js/styles/github-dark.css' // 默认暗色主题

// 配置 marked
marked.setOptions({
  renderer: new marked.Renderer(),
  gfm: true, // 启用 GitHub Flavored Markdown
  breaks: true, // 允许换行符
  highlight: function (code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext'
    return hljs.highlight(code, { language }).value
  },
})

export const MarkdownRenderer = defineComponent({
  name: 'MarkdownRenderer',
  props: {
    source: {
      type: String,
      required: true
    },
    theme: {
      type: String as PropType<'light' | 'dark'>,
      default: 'light'
    }
  },
  setup(props) {
    const renderedMarkdown = computed(() => {
      return marked.parse(props.source)
    })

    const themeClass = computed(() => {
      return props.theme === 'dark' ? 'markdown-body-dark' : 'markdown-body-light'
    })

    return () => h('div', {
      class: ['markdown-body', themeClass.value],
      innerHTML: renderedMarkdown.value
    })
  }
})
