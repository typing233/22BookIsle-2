<template>
  <div class="settings-page">
    <h1 class="page-title">设置</h1>
    <div class="card">
      <h2>阅读偏好</h2>
      <div class="form-group">
        <label>默认阅读模式</label>
        <select v-model="settings.readMode">
          <option value="scroll">连续滚动</option>
          <option value="paginate">翻页模式</option>
        </select>
      </div>
      <div class="form-group">
        <label>默认字体大小</label>
        <select v-model="settings.fontSize">
          <option value="90">小</option>
          <option value="100">中</option>
          <option value="120">大</option>
          <option value="140">特大</option>
        </select>
      </div>
      <button class="btn-primary" @click="saveSettings">保存设置</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const settings = ref({
  readMode: localStorage.getItem('readMode') || 'scroll',
  fontSize: localStorage.getItem('fontSize') || '100',
});

function saveSettings() {
  localStorage.setItem('readMode', settings.value.readMode);
  localStorage.setItem('fontSize', settings.value.fontSize);
  alert('设置已保存');
}
</script>

<style scoped>
.settings-page .card { max-width: 500px; }
.settings-page h2 { font-size: 16px; margin-bottom: 16px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; margin-bottom: 4px; }
.form-group select { width: auto; }
</style>
