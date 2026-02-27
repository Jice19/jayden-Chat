import { defineComponent, h, type PropType } from 'vue'
import { createMarkdownRenderer } from 'vue-mdr'
import CodeBlockRenderer from './CodeBlockRenderer.vue'

const BaseMarkdownRenderer = createMarkdownRenderer({
  codeBlock: {
    renderer: CodeBlockRenderer
  }
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
    return () => h(BaseMarkdownRenderer, { source: props.source, theme: props.theme })
  }
})
