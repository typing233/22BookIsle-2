<template>
  <div class="bookmark-panel">
    <div class="panel-header">
      <h3>书签</h3>
      <button class="btn-secondary btn-sm" @click="$emit('close')">×</button>
    </div>
    <div class="bookmark-list">
      <div v-if="!bookmarks.length" class="empty-sm">暂无书签</div>
      <div
        v-for="bm in bookmarks"
        :key="bm.id"
        class="bookmark-item"
      >
        <div class="bm-content" @click="$emit('navigate', bm)">
          <span class="bm-label">{{ bm.label || '未命名书签' }}</span>
          <span class="bm-note" v-if="bm.note">{{ bm.note }}</span>
        </div>
        <button class="btn-danger btn-sm" @click.stop="$emit('delete', bm.id)">×</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ bookmarks: any[] }>();
defineEmits(['navigate', 'delete', 'close']);
</script>

<style scoped>
.bookmark-panel {
  width: 260px;
  background: var(--bg-card);
  border-left: 1px solid var(--border);
  overflow-y: auto;
  flex-shrink: 0;
}
.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--border);
}
.panel-header h3 { font-size: 14px; }
.bookmark-list { padding: 8px; }
.empty-sm { padding: 20px; text-align: center; color: var(--text-light); font-size: 13px; }
.bookmark-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px; border-radius: 4px; margin-bottom: 4px;
}
.bookmark-item:hover { background: var(--bg); }
.bm-content { flex: 1; cursor: pointer; }
.bm-label { font-size: 13px; display: block; }
.bm-note { font-size: 11px; color: var(--text-light); display: block; margin-top: 2px; }
</style>
