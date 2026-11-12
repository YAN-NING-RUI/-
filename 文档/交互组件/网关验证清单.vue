<script setup>
import { onMounted, ref } from 'vue'

defineProps({ items: { type: Array, required: true } })
const storageKey = 'embedded-notes:stm32h743-fdcan-checklist'
const checked = ref({})

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) checked.value = saved
  } catch {
    // 浏览器禁止存储时仍可在当前页面勾选。
  }
})

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(checked.value))
  } catch {
    // 浏览器禁止存储时保留当前页面状态。
  }
}
</script>

<template>
  <div class="note-demo">
    <label v-for="item in items" :key="item" class="gateway-check">
      <input v-model="checked[item]" type="checkbox" @change="save">
      <span>{{ item }}</span>
    </label>
    <p role="status">进度 {{ items.filter(item => checked[item]).length }} / {{ items.length }} · 勾选记录保存在当前浏览器</p>
  </div>
</template>

<style scoped>
.gateway-check {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  margin-block: 0.35rem;
}
.gateway-check input { accent-color: var(--vp-c-brand-3); }
</style>
