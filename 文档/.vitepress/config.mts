import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: '嵌入式软硬件笔记',
  description: '记录 STM32、底层固件、外设通信和硬件调试。',
  base: process.env.DOCS_BASE || '/',
  lastUpdated: true,
  rewrites: { '首页.md': 'index.md' },
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '目录', link: '/目录' }
    ],
    sidebar: [
      {
        text: '固件基础',
        items: [
          { text: 'STM32H743 寄存器与内存布局', link: '/固件基础/STM32H743寄存器与内存布局' }
        ]
      },
      {
        text: '外设通信',
        items: [
          { text: 'STM32H743 FDCAN 工程手册', link: '/外设通信/STM32H743-FDCAN工程手册' }
        ]
      },
      {
        text: '实时系统',
        items: [
          { text: 'FreeRTOS 与 I²C 调试', link: '/实时系统/FreeRTOS与I2C调试' }
        ]
      },
      {
        text: '硬件设计',
        items: [
          { text: '隔离采样电路', link: '/硬件设计/隔离采样电路' }
        ]
      }
    ],
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdated: { text: '最后更新' },
    sidebarMenuLabel: '专题目录',
    returnToTopLabel: '返回顶部',
    darkModeSwitchLabel: '外观',
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索笔记', buttonAriaLabel: '搜索笔记' },
          modal: {
            noResultsText: '未找到相关笔记',
            resetButtonTitle: '清除搜索',
            footer: { selectText: '打开', navigateText: '选择', closeText: '关闭' }
          }
        }
      }
    }
  }
})
