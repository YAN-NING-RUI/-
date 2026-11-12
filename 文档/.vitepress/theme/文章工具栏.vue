<script setup>
import { computed, ref, watch } from 'vue'
import { useData, withBase } from 'vitepress'

const { page } = useData()
const topic = computed(() => page.value.relativePath.split('/').slice(0, -1).join(' / '))
const status = ref('')

watch(() => page.value.relativePath, () => {
  status.value = ''
})

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    status.value = '链接已复制'
  } catch {
    status.value = '复制失败，请从地址栏复制'
  }
}
</script>

<template>
  <div v-if="topic" class="article-tools">
    <nav aria-label="文章所属专题">
      <a :href="withBase('/目录.html')">文档目录</a>
      <span aria-hidden="true">/</span>
      <span>{{ topic }}</span>
    </nav>
    <div class="article-share">
      <span class="article-share-status" role="status">{{ status }}</span>
      <button type="button" @click="copyLink">复制链接</button>
    </div>
  </div>
</template>
