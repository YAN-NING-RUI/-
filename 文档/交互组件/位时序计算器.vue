<script setup>
import { computed, ref } from 'vue'

const clock = ref(25)
const prescaler = ref(1)
const segment1 = ref(39)
const segment2 = ref(10)

const timing = computed(() => {
  const segments = [prescaler.value, segment1.value, segment2.value]
  if (!Number.isFinite(clock.value) || clock.value <= 0 ||
      !segments.every(value => Number.isSafeInteger(value) && value > 0)) {
    return null
  }

  const quantum = prescaler.value / clock.value * 1000
  const quantaPerBit = 1 + segment1.value + segment2.value
  const bitTime = quantum * quantaPerBit
  const bitrate = 1e6 / bitTime
  if (!Number.isFinite(bitrate) || !Number.isFinite(bitTime)) return null

  return {
    quantum,
    quantaPerBit,
    bitTime,
    bitrate,
    samplePoint: (1 + segment1.value) / quantaPerBit * 100
  }
})
</script>

<template>
  <div class="note-demo">
    <div class="note-demo-controls">
      <label>FDCAN 内核时钟（MHz）<input v-model.number="clock" type="number" min="0" step="any"></label>
      <label>预分频<input v-model.number="prescaler" type="number" min="1" step="1"></label>
      <label>TimeSeg1（tq）<input v-model.number="segment1" type="number" min="1" step="1"></label>
      <label>TimeSeg2（tq）<input v-model.number="segment2" type="number" min="1" step="1"></label>
    </div>
    <div v-if="timing" role="status">
      <p><strong>{{ timing.bitrate.toFixed(2) }} kbit/s</strong> · 采样点 {{ timing.samplePoint.toFixed(2) }}%</p>
      <div class="timing-bar" aria-hidden="true">
        <span class="sync-segment"></span>
        <span class="first-segment" :style="{ flexGrow: segment1 }"></span>
        <span class="second-segment" :style="{ flexGrow: segment2 }"></span>
      </div>
      <p>同步段 1 tq → TimeSeg1 {{ segment1 }} tq → 采样点 → TimeSeg2 {{ segment2 }} tq</p>
      <p>每 tq {{ timing.quantum.toFixed(2) }} ns · 每位 {{ timing.quantaPerBit }} tq（{{ timing.bitTime.toFixed(2) }} ns）</p>
    </div>
    <p v-else role="status">请输入正数时钟，以及正整数预分频和时间段。</p>
    <small>计算按理想位时序关系进行。可用参数范围和 SJW 约束以芯片参考手册为准。</small>
  </div>
</template>

<style scoped>
.timing-bar {
  display: flex;
  height: 0.65rem;
  overflow: hidden;
  border-radius: 999px;
}
.timing-bar span { flex-basis: 0; }
.sync-segment { flex-grow: 1; background: #df9a3e; }
.first-segment { background: var(--vp-c-brand-3); }
.second-segment { background: var(--vp-c-indigo-2); }
</style>
