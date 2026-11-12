import { h } from 'vue'
import { withBase } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import ArticleTools from './文章工具栏.vue'
import './站点样式.css'

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, {
    'sidebar-nav-before': () => h('a', { class: 'sidebar-home', href: withBase('/') }, '← 返回首页'),
    'doc-before': () => h(ArticleTools)
  })
}
