import { defineConfig } from 'vitepress'

const topics = [
  {
    text: '固件基础',
    collapsed: false,
    items: [
      { text: 'MMIO 与 volatile', link: '/固件基础/MMIO与volatile' },
      { text: 'STM32H743 存储映射', link: '/固件基础/STM32H743存储映射' },
      { text: '链接脚本与启动初始化', link: '/固件基础/链接脚本与启动初始化' },
      { text: 'Cache 与 DMA 一致性', link: '/固件基础/Cache与DMA一致性' },
      {
        text: 'Cortex-M7 汇编',
        collapsed: false,
        items: [
          { text: 'Thumb-2 指令与寻址', link: '/固件基础/Cortex-M7汇编/Thumb-2指令与寻址' },
          { text: '栈与异常入栈', link: '/固件基础/Cortex-M7汇编/栈与异常入栈' },
          { text: '函数调用与 ABI', link: '/固件基础/Cortex-M7汇编/函数调用与ABI' }
        ]
      }
    ]
  },
  {
    text: '外设通信',
    collapsed: false,
    items: [
      {
        text: 'FDCAN 网关',
        link: '/外设通信/FDCAN网关/工程导读',
        collapsed: false,
        items: [
          { text: '时钟、引脚与位时序', link: '/外设通信/FDCAN网关/时钟引脚与位时序' },
          { text: 'Message RAM 与收发中断', link: '/外设通信/FDCAN网关/消息存储与收发中断' },
          { text: '联调与故障排查', link: '/外设通信/FDCAN网关/联调与故障排查' }
        ]
      },
      { text: 'I²C 驱动与时序', link: '/外设通信/I2C驱动与时序' }
    ]
  },
  {
    text: '实时系统',
    collapsed: false,
    items: [
      { text: 'FreeRTOS 任务与内存排查', link: '/实时系统/FreeRTOS任务与内存排查' }
    ]
  },
  {
    text: '硬件设计',
    collapsed: false,
    items: [
      { text: '隔离采样电路', link: '/硬件设计/隔离采样电路' }
    ]
  }
]

export default defineConfig({
  lang: 'zh-CN',
  title: '嵌入式软硬件笔记',
  description: '记录 STM32、底层固件、外设通信和硬件调试。',
  base: process.env.DOCS_BASE || '/',
  lastUpdated: true,
  appearance: 'dark',
  rewrites: { '首页.md': 'index.md' },
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '专题', items: topics.map(({ text, items }) => ({ text, link: items[0].link })) },
      { text: '文档目录', link: '/目录' }
    ],
    sidebar: topics,
    socialLinks: [{ icon: 'github', link: 'https://github.com/YAN-NING-RUI/-', ariaLabel: 'GitHub 仓库' }],
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
          button: { buttonText: '搜索文档…', buttonAriaLabel: '搜索文档' },
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
