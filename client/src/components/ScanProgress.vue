<template>
  <div v-if="scanProgress" class="scan-progress-bar">
    <div class="scan-info">
      <span class="scan-status">扫描中: {{ scanProgress.currentFile || '...' }}</span>
      <span class="scan-count">{{ scanProgress.processed }}/{{ scanProgress.total }}</span>
    </div>
    <div class="progress-bar">
      <div class="progress-bar-fill" :style="{ width: progressPct }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useWebSocket } from '../composables/useWebSocket';

const { scanProgress } = useWebSocket();

const progressPct = computed(() => {
  if (!scanProgress.value || !scanProgress.value.total) return '0%';
  return `${Math.round((scanProgress.value.processed / scanProgress.value.total) * 100)}%`;
});
</script>

<style scoped>
.scan-progress-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  padding: 12px 24px;
  box-shadow: 0 -2px 8px rgba(0,0,0,0.1);
  z-index: 200;
}
.scan-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-light);
  margin-bottom: 6px;
}
.scan-status {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70%;
}
</style>
