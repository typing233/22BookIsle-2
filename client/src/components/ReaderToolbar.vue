<template>
  <div class="reader-toolbar">
    <div class="toolbar-left">
      <button class="btn-secondary btn-sm" @click="$emit('back')">← 返回</button>
      <h3 class="book-title">{{ book.title }}</h3>
    </div>
    <div class="toolbar-center">
      <span class="progress-text">{{ Math.round(percentage * 100) }}%</span>
    </div>
    <div class="toolbar-right">
      <button class="btn-secondary btn-sm" @click="$emit('zoom-out')" title="缩小">A-</button>
      <button class="btn-secondary btn-sm" @click="$emit('zoom-in')" title="放大">A+</button>
      <button class="btn-secondary btn-sm" @click="$emit('toggle-toc')" title="目录">目录</button>
      <button class="btn-secondary btn-sm" @click="$emit('toggle-bookmarks')" title="书签列表">书签</button>
      <button class="btn-secondary btn-sm" @click="$emit('add-bookmark')" title="快速添加书签">+ 签</button>
      <button class="btn-secondary btn-sm" @click="$emit('add-note')" title="添加批注">+ 注</button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  book: any;
  percentage: number;
  showToc: boolean;
}>();

defineEmits(['back', 'toggle-toc', 'toggle-bookmarks', 'add-bookmark', 'add-note', 'zoom-in', 'zoom-out']);
</script>

<style scoped>
.reader-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.book-title {
  font-size: 14px;
  font-weight: 500;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.progress-text {
  font-size: 13px;
  color: var(--text-light);
}
</style>
