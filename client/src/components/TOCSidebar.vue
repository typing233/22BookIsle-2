<template>
  <div class="toc-sidebar">
    <div class="toc-header">
      <h3>目录</h3>
      <button class="btn-secondary btn-sm" @click="$emit('close')">×</button>
    </div>
    <div class="toc-list">
      <div
        v-for="(item, idx) in toc"
        :key="idx"
        class="toc-item"
        :style="{ paddingLeft: `${(item.level || 0) * 16 + 12}px` }"
        @click="$emit('navigate', item)"
      >
        {{ item.label || item.title }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ toc: any[] }>();
defineEmits(['navigate', 'close']);
</script>

<style scoped>
.toc-sidebar {
  width: 280px;
  background: var(--bg-card);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  flex-shrink: 0;
}
.toc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.toc-header h3 { font-size: 14px; }
.toc-list { padding: 8px 0; }
.toc-item {
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
  margin: 0 8px;
}
.toc-item:hover { background: var(--bg); }
</style>
