<script setup>
import { ref } from 'vue'

const capacity = 4
const count = ref(0)
const events = ref(0)
const mode = ref('new')
const watermark = ref(2)
const status = ref('等待接收')

function receive() {
  if (count.value >= capacity) return

  count.value += 1
  const triggered = mode.value === 'new' ||
    (mode.value === 'watermark' && count.value === watermark.value) ||
    (mode.value === 'full' && count.value === capacity)

  if (triggered) events.value += 1
  status.value = triggered ? '当前中断条件已触发' : '已接收，尚未达到当前触发条件'
}

function read() {
  if (count.value === 0) return

  count.value -= 1
  status.value = 'CPU 已读取并释放一帧'
}

function reset() {
  count.value = 0
  events.value = 0
  status.value = 'FIFO 和计数已清空'
}
</script>

<template>
  <div class="note-demo">
    <div class="note-demo-controls">
      <label>
        中断事件
        <select v-model="mode" @change="status = '已更改中断条件'">
          <option value="new">NEW_MESSAGE · 每条新报文</option>
          <option value="watermark">WATERMARK · 达到水位</option>
          <option value="full">FULL · FIFO 满</option>
        </select>
      </label>
      <label>
        水位阈值
        <select v-model="watermark" :disabled="mode !== 'watermark'" @change="status = '已更改水位阈值'">
          <option v-for="slot in capacity" :key="slot" :value="slot">{{ slot }} 帧</option>
        </select>
      </label>
    </div>
    <div class="fifo-slots" aria-hidden="true">
      <span v-for="slot in capacity" :key="slot" :class="{ occupied: slot <= count }">
        {{ slot <= count ? '已占用' : '空' }}
      </span>
    </div>
    <div class="note-demo-actions">
      <button type="button" :disabled="count === capacity" @click="receive">接收一帧</button>
      <button type="button" :disabled="count === 0" @click="read">读取一帧</button>
      <button type="button" @click="reset">清空 FIFO</button>
    </div>
    <p role="status">FIFO {{ count }} / {{ capacity }} 帧 · 累计 {{ events }} 次事件 · {{ status }}</p>
  </div>
</template>

<style scoped>
.fifo-slots {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.35rem;
  margin-block: 0.75rem;
}
.fifo-slots span {
  padding: 0.4rem 0;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 0.35rem;
  text-align: center;
}
.fifo-slots .occupied {
  border-style: solid;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}
</style>
