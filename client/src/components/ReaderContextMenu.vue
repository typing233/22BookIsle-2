<template>
  <Teleport to="body">
    <div v-if="visible" class="context-menu" :style="{ top: `${y}px`, left: `${x}px` }" @click.stop>
      <div class="context-menu-item" @click="emit('add-bookmark')">
        <span class="cm-icon">🔖</span> 添加书签
      </div>
      <div class="context-menu-item" @click="emit('add-note')">
        <span class="cm-icon">📝</span> 添加批注
      </div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" @click="emit('toggle-toc')">
        <span class="cm-icon">📑</span> 目录
      </div>
      <div class="context-menu-item" @click="emit('toggle-bookmarks')">
        <span class="cm-icon">📚</span> 书签列表
      </div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" @click="emit('fullscreen')">
        <span class="cm-icon">⛶</span> 全屏
      </div>
      <div class="context-menu-item" @click="emit('settings')">
        <span class="cm-icon">⚙</span> 阅读设置
      </div>
    </div>
    <div v-if="visible" class="context-menu-backdrop" @click="emit('close')" @contextmenu.prevent="emit('close')"></div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean;
  x: number;
  y: number;
}>();

const emit = defineEmits<{
  'add-bookmark': [];
  'add-note': [];
  'toggle-toc': [];
  'toggle-bookmarks': [];
  'fullscreen': [];
  'settings': [];
  'close': [];
}>();
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 9999;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  min-width: 180px;
  padding: 4px 0;
}
.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}
.context-menu-item:hover {
  background: var(--bg);
}
.cm-icon { font-size: 14px; width: 20px; text-align: center; }
.context-menu-separator {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}
.context-menu-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 9998;
}
</style>
