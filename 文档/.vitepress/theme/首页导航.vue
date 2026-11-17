<script setup>
import { withBase } from 'vitepress'

const topics = [
  { name: '固件基础', detail: '寄存器、存储映射、Cache 与汇编', tone: 'blue' },
  { name: '外设通信', detail: 'FDCAN 网关与 I²C 驱动', tone: 'mint' },
  { name: '实时系统', detail: '线程创建、任务调度与内存排查', tone: 'violet' },
  { name: '硬件设计', detail: '隔离采样、滤波与差分输出', tone: 'amber' }
]

const reading = [
  { title: 'STM32H743 存储映射', detail: '变量放在哪，读写经过哪里？', route: '/固件基础/STM32H743存储映射.html' },
  { title: 'Thumb-2 指令与寻址', detail: '怎样读懂 CubeIDE 的反汇编？', route: '/固件基础/Cortex-M7汇编/Thumb-2指令与寻址.html' },
  { title: 'FDCAN 网关导读', detail: '怎样从回环测试走到双路转发？', route: '/外设通信/FDCAN网关/工程导读.html' },
  { title: 'FreeRTOS 任务与内存排查', detail: '调度器启动后，任务为何没有运行？', route: '/实时系统/FreeRTOS任务与内存排查.html' }
]

const catalog = withBase('/目录.html')
</script>

<template>
  <div class="notes-overview">
    <header class="notes-hero">
      <div class="notes-hero-copy">
        <h1 id="嵌入式软硬件笔记">嵌入式软硬件笔记</h1>
        <p>从 Cortex-M7 的寄存器与内存，到外设通信、实时任务和板级采样。</p>
        <a class="notes-primary" :href="catalog">浏览文档目录 <span aria-hidden="true">↗</span></a>
      </div>
      <div class="board" aria-hidden="true">
        <div class="board-traces"></div>
        <div class="board-core">
          <span>STM32</span>
          <strong>H743</strong>
          <span>CORTEX-M7</span>
        </div>
        <span class="board-point board-point-top"></span>
        <span class="board-point board-point-bottom"></span>
      </div>
    </header>

    <section aria-labelledby="按专题浏览">
      <h2 id="按专题浏览">按专题浏览</h2>
      <div class="topic-grid">
        <a v-for="topic in topics" :key="topic.name" class="topic-card" :data-tone="topic.tone" :href="catalog + '#' + topic.name">
          <strong>{{ topic.name }} <span class="entry-arrow" aria-hidden="true">↗</span></strong>
          <span class="entry-detail">{{ topic.detail }}</span>
        </a>
      </div>
    </section>

    <section aria-labelledby="从手头的问题开始">
      <h2 id="从手头的问题开始">从手头的问题开始</h2>
      <div class="reading-grid">
        <a v-for="entry in reading" :key="entry.route" class="reading-entry" :href="withBase(entry.route)">
          <span class="entry-detail">{{ entry.detail }}</span>
          <strong>{{ entry.title }} <span class="entry-arrow" aria-hidden="true">→</span></strong>
        </a>
      </div>
    </section>
  </div>
</template>

<style scoped>
.notes-overview {
  container-type: inline-size;
  padding-bottom: 24px;
}

.notes-hero {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  min-height: 258px;
  overflow: hidden;
  padding: clamp(24px, 5cqw, 56px);
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
  background: var(--notes-hero-bg);
}

.notes-hero-copy {
  position: relative;
  z-index: 1;
  max-width: 64%;
}

.notes-hero h1 {
  font-size: clamp(30px, 5.3cqw, 55px);
  line-height: 1.15;
  letter-spacing: -.055em;
}

.notes-hero p {
  max-width: 29em;
  margin: 14px 0 22px;
  color: var(--vp-c-text-2);
}

.notes-overview a {
  text-decoration: none;
}

.notes-hero .notes-primary {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 7px 15px;
  border-radius: 8px;
  color: var(--notes-button-text);
  background: var(--notes-button);
  font-size: 14px;
  font-weight: 650;
}

.notes-hero .notes-primary:hover {
  color: var(--notes-button-text);
  filter: brightness(1.10);
}

.board {
  position: absolute;
  inset: 0 0 0 auto;
  width: 47%;
  color: var(--notes-board);
  background-image: radial-gradient(currentColor .65px, transparent .65px);
  background-size: 16px 16px;
  mask-image: linear-gradient(90deg, transparent, #000 22%);
}

.board::before {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 58% 50%, var(--notes-glow), transparent 68%);
  content: '';
}

.board-core {
  position: absolute;
  top: 50%;
  left: 55%;
  display: grid;
  place-content: center;
  width: clamp(110px, 17cqw, 168px);
  aspect-ratio: 1;
  transform: translate(-50%, -50%) rotate(-8deg);
  border: 1px solid var(--notes-board-edge);
  border-radius: 16px;
  outline: 1px solid var(--notes-board-edge);
  outline-offset: 10px;
  background: var(--notes-board-chip);
  box-shadow: 0 14px 44px var(--notes-glow);
  color: var(--vp-c-brand-1);
  text-align: center;
  font: 600 clamp(8px, 1.14cqw, 12px)/1.5 var(--vp-font-family-mono);
  letter-spacing: .12em;
}

.board-core strong {
  color: var(--vp-c-text-1);
  font-size: clamp(22px, 3.6cqw, 35px);
  line-height: 1.25;
  letter-spacing: .04em;
}

.board-core::before,
.board-core::after {
  position: absolute;
  inset-inline: -18px;
  height: 10px;
  background: repeating-linear-gradient(90deg, transparent 0 7px, var(--notes-board-edge) 7px 10px);
  content: '';
}

.board-core::before { top: -17px; }
.board-core::after { bottom: -17px; }

.board-traces {
  position: absolute;
  inset: 24% 0 24% 10%;
  border-block: 1px solid var(--notes-board-edge);
  background: repeating-linear-gradient(0deg, transparent 0 12px, var(--notes-board) 12px 13px, transparent 13px 29px);
  transform: skewY(-8deg);
}

.board-point {
  position: absolute;
  width: 7px;
  height: 7px;
  border: 1px solid var(--notes-board-edge);
  border-radius: 50%;
  background: var(--notes-board-chip);
}

.board-point-top { top: 22%; right: 10%; }
.board-point-bottom { bottom: 22%; left: 28%; }

.notes-overview section h2 {
  margin: 30px 0 14px;
  padding: 0;
  border: 0;
  font-size: 20px;
}

.topic-grid,
.reading-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.topic-card {
  --tone: var(--vp-c-brand-1);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

.topic-card[data-tone="mint"] { --tone: var(--notes-mint); }
.topic-card[data-tone="violet"] { --tone: var(--notes-violet); }
.topic-card[data-tone="amber"] { --tone: var(--notes-amber); }

.topic-card::before {
  width: 20px;
  height: 2px;
  margin-bottom: 7px;
  border-radius: 2px;
  background: var(--tone);
  content: '';
}

.topic-card strong,
.reading-entry strong {
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  color: var(--vp-c-text-1);
  font-weight: 650;
}

.entry-arrow {
  margin-left: auto;
  color: var(--tone, var(--vp-c-brand-1));
}

.entry-detail {
  color: var(--vp-c-text-2);
  font-size: 13px;
  line-height: 1.55;
}

.reading-entry {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 11px 13px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 9px;
}

.topic-card:hover,
.reading-entry:hover {
  border-color: var(--tone, var(--vp-c-brand-1));
  background: var(--vp-c-bg-elv);
}

@container (min-width: 800px) {
  .topic-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@container (max-width: 555px) {
  .notes-hero { min-height: 214px; }
  .notes-hero-copy { max-width: 100%; }
  .board { width: 62%; opacity: .30; }
  .notes-hero p { max-width: 19em; }
  .reading-grid { grid-template-columns: 1fr; }
  .topic-card { padding: 13px; }
}

@container (max-width: 290px) {
  .topic-grid { grid-template-columns: 1fr; }
}
</style>
