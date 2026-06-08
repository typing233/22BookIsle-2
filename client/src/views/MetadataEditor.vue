<template>
  <div class="metadata-page">
    <h1 class="page-title">元数据管理</h1>

    <div class="tabs">
      <button :class="{ active: activeTab === 'templates' }" @click="activeTab = 'templates'">模板规则</button>
      <button :class="{ active: activeTab === 'batch' }" @click="activeTab = 'batch'">批量处理</button>
      <button :class="{ active: activeTab === 'history' }" @click="activeTab = 'history'">修改历史</button>
    </div>

    <!-- Templates Tab -->
    <section v-if="activeTab === 'templates'" class="tab-content">
      <div class="section-header">
        <h2 class="section-title">模板列表</h2>
        <button class="btn-primary" @click="showCreateTemplate = true">新建模板</button>
      </div>

      <div v-if="templates.length" class="template-list">
        <div v-for="t in templates" :key="t.id" class="template-card card">
          <div class="template-header">
            <h3>{{ t.name }}</h3>
            <div class="template-actions">
              <button class="btn-secondary btn-sm" @click="previewTemplate(t)">预览</button>
              <button class="btn-danger btn-sm" @click="deleteTemplate(t.id)">删除</button>
            </div>
          </div>
          <code class="template-pattern">{{ t.pattern }}</code>
          <div class="template-mapping">
            <span v-for="(field, group) in t.field_mapping" :key="group" class="mapping-chip">
              ${{ group }} → {{ field }}
            </span>
          </div>
          <p v-if="t.example" class="template-example">示例: {{ t.example }}</p>
        </div>
      </div>
      <p v-else class="empty">暂无模板，点击上方按钮创建</p>
    </section>

    <!-- Batch Tab -->
    <section v-if="activeTab === 'batch'" class="tab-content">
      <div class="batch-controls">
        <select v-model="selectedTemplateId" class="sort-select">
          <option value="">选择模板...</option>
          <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <select v-model="selectedLibraryId" class="sort-select">
          <option value="">选择书库...</option>
          <option v-for="lib in libraries" :key="lib.id" :value="lib.id">{{ lib.name }}</option>
        </select>
        <button class="btn-primary" :disabled="!selectedTemplateId || !selectedLibraryId" @click="loadPreview">预览效果</button>
      </div>

      <div v-if="previewResults.length" class="preview-table">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" v-model="selectAll" @change="toggleSelectAll" /></th>
              <th>文件名</th>
              <th>当前标题</th>
              <th>提取标题</th>
              <th>当前作者</th>
              <th>提取作者</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in previewResults" :key="r.book_id" :class="{ unmatched: !r.matched }">
              <td><input type="checkbox" :value="r.book_id" v-model="selectedBookIds" :disabled="!r.matched" /></td>
              <td class="filename">{{ r.filename }}</td>
              <td>{{ r.current?.title || '-' }}</td>
              <td class="new-value">{{ r.extracted?.title || '-' }}</td>
              <td>{{ r.current?.author || '-' }}</td>
              <td class="new-value">{{ r.extracted?.author || '-' }}</td>
            </tr>
          </tbody>
        </table>
        <div class="batch-apply-bar">
          <span>已选 {{ selectedBookIds.length }} 本</span>
          <button class="btn-primary" :disabled="selectedBookIds.length === 0 || applying" @click="applyTemplate">
            {{ applying ? '应用中...' : '应用修改' }}
          </button>
        </div>
      </div>
    </section>

    <!-- History Tab -->
    <section v-if="activeTab === 'history'" class="tab-content">
      <div v-if="history.length" class="history-list">
        <div v-for="h in history" :key="h.id" class="history-item card">
          <div class="history-info">
            <span class="history-field">{{ h.field_name }}</span>
            <span class="history-change">"{{ h.old_value || '空' }}" → "{{ h.new_value || '空' }}"</span>
            <span class="history-time">{{ formatTime(h.created_at) }}</span>
          </div>
          <button class="btn-secondary btn-sm" @click="rollback(h.batch_id || undefined, h.id)">回滚</button>
        </div>
      </div>
      <p v-else class="empty">暂无修改记录</p>
    </section>

    <!-- Create Template Modal -->
    <div v-if="showCreateTemplate" class="modal-overlay" @click.self="showCreateTemplate = false">
      <div class="modal card">
        <h3>新建元数据模板</h3>
        <div class="form-group">
          <label>模板名称</label>
          <input v-model="templateForm.name" placeholder="例如：作者-书名" />
        </div>
        <div class="form-group">
          <label>正则表达式</label>
          <input v-model="templateForm.pattern" placeholder="例如：^(.+?)\\s*-\\s*(.+)$" class="code-input" />
          <small>使用捕获组提取字段</small>
        </div>
        <div class="form-group">
          <label>字段映射 (捕获组序号 → 字段名)</label>
          <div class="mapping-editor">
            <div v-for="(_, idx) in templateForm.mappings" :key="idx" class="mapping-row">
              <input v-model="templateForm.mappings[idx].group" type="number" min="1" placeholder="组号" class="group-input" />
              <span>→</span>
              <select v-model="templateForm.mappings[idx].field">
                <option value="title">标题</option>
                <option value="author">作者</option>
                <option value="publisher">出版社</option>
                <option value="language">语言</option>
              </select>
              <button class="btn-danger btn-sm" @click="templateForm.mappings.splice(idx, 1)">×</button>
            </div>
            <button class="btn-secondary btn-sm" @click="templateForm.mappings.push({ group: '', field: 'title' })">+ 添加映射</button>
          </div>
        </div>
        <div class="form-group">
          <label>测试示例</label>
          <input v-model="templateForm.example" placeholder="测试文件名" />
          <div v-if="templateForm.example && templateForm.pattern" class="test-result">
            <strong>匹配结果:</strong> {{ testPattern() }}
          </div>
        </div>
        <div class="form-actions">
          <button class="btn-secondary" @click="showCreateTemplate = false">取消</button>
          <button class="btn-primary" @click="createTemplate">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../api/client';

const activeTab = ref<'templates' | 'batch' | 'history'>('templates');
const templates = ref<any[]>([]);
const libraries = ref<any[]>([]);
const history = ref<any[]>([]);
const previewResults = ref<any[]>([]);
const selectedBookIds = ref<number[]>([]);
const selectedTemplateId = ref('');
const selectedLibraryId = ref('');
const selectAll = ref(false);
const applying = ref(false);
const showCreateTemplate = ref(false);

const templateForm = ref({
  name: '',
  pattern: '',
  example: '',
  mappings: [{ group: '1', field: 'author' }, { group: '2', field: 'title' }] as { group: string; field: string }[],
});

onMounted(async () => {
  await Promise.all([loadTemplates(), loadLibraries()]);
});

async function loadTemplates() {
  const res = await api.get('/metadata/templates');
  templates.value = res.data;
}

async function loadLibraries() {
  const res = await api.get('/libraries');
  libraries.value = res.data;
}

async function createTemplate() {
  const fieldMapping: Record<string, string> = {};
  for (const m of templateForm.value.mappings) {
    if (m.group && m.field) fieldMapping[m.group] = m.field;
  }

  await api.post('/metadata/templates', {
    name: templateForm.value.name,
    pattern: templateForm.value.pattern,
    field_mapping: fieldMapping,
    example: templateForm.value.example || undefined,
  });

  showCreateTemplate.value = false;
  templateForm.value = { name: '', pattern: '', example: '', mappings: [{ group: '1', field: 'author' }, { group: '2', field: 'title' }] };
  await loadTemplates();
}

async function deleteTemplate(id: number) {
  if (!confirm('确认删除此模板?')) return;
  await api.delete(`/metadata/templates/${id}`);
  await loadTemplates();
}

async function loadPreview() {
  const booksRes = await api.get('/books', { params: { library_id: selectedLibraryId.value, limit: 100 } });
  const bookIds = booksRes.data.data.map((b: any) => b.id);

  const res = await api.post(`/metadata/templates/${selectedTemplateId.value}/preview`, { book_ids: bookIds });
  previewResults.value = res.data.map((r: any) => ({
    ...r,
    filename: booksRes.data.data.find((b: any) => b.id === r.book_id)?.file_path?.split('/').pop() || '',
  }));
  selectedBookIds.value = res.data.filter((r: any) => r.matched).map((r: any) => r.book_id);
}

async function previewTemplate(t: any) {
  selectedTemplateId.value = t.id;
  activeTab.value = 'batch';
}

async function applyTemplate() {
  applying.value = true;
  try {
    await api.post(`/metadata/templates/${selectedTemplateId.value}/apply`, { book_ids: selectedBookIds.value });
    previewResults.value = [];
    selectedBookIds.value = [];
    alert('应用成功');
  } finally {
    applying.value = false;
  }
}

function toggleSelectAll() {
  if (selectAll.value) {
    selectedBookIds.value = previewResults.value.filter((r) => r.matched).map((r) => r.book_id);
  } else {
    selectedBookIds.value = [];
  }
}

async function rollback(batchId?: string, historyId?: number) {
  if (!confirm('确认回滚此修改?')) return;
  await api.post('/metadata/rollback', { batch_id: batchId, history_id: historyId });
  await loadHistory();
}

async function loadHistory() {
  const booksRes = await api.get('/books', { params: { limit: 5, sort: 'created_at', order: 'desc' } });
  const allHistory: any[] = [];
  for (const book of booksRes.data.data) {
    const res = await api.get(`/metadata/books/${book.id}/history`);
    allHistory.push(...res.data);
  }
  history.value = allHistory.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50);
}

function testPattern(): string {
  try {
    const regex = new RegExp(templateForm.value.pattern);
    const match = regex.exec(templateForm.value.example);
    if (!match) return '未匹配';
    const results: string[] = [];
    for (const m of templateForm.value.mappings) {
      const idx = Number(m.group);
      if (match[idx]) results.push(`${m.field}: "${match[idx]}"`);
    }
    return results.join(', ') || '未匹配到捕获组';
  } catch {
    return '无效正则表达式';
  }
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleString('zh-CN');
}

if (activeTab.value === 'history') loadHistory();
</script>

<style scoped>
.metadata-page { max-width: 1000px; margin: 0 auto; }
.tabs { display: flex; gap: 0; margin-bottom: 24px; border-bottom: 2px solid var(--border); }
.tabs button {
  padding: 10px 20px; background: none; border: none; font-size: 14px; font-weight: 500;
  cursor: pointer; color: var(--text-light); border-bottom: 2px solid transparent; margin-bottom: -2px;
}
.tabs button.active { color: var(--primary); border-bottom-color: var(--primary); }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-title { font-size: 16px; font-weight: 600; }
.template-list { display: flex; flex-direction: column; gap: 12px; }
.template-card { padding: 16px; }
.template-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.template-header h3 { font-size: 15px; }
.template-actions { display: flex; gap: 6px; }
.template-pattern {
  display: block; padding: 6px 10px; background: var(--bg); border-radius: 4px;
  font-size: 12px; margin-bottom: 8px; word-break: break-all;
}
.template-mapping { display: flex; flex-wrap: wrap; gap: 6px; }
.mapping-chip {
  padding: 2px 8px; background: var(--bg); border-radius: 4px; font-size: 12px;
}
.template-example { font-size: 12px; color: var(--text-light); margin-top: 6px; }
.batch-controls { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; }
.preview-table { overflow-x: auto; }
.preview-table table { width: 100%; border-collapse: collapse; font-size: 13px; }
.preview-table th, .preview-table td { padding: 8px; border-bottom: 1px solid var(--border); text-align: left; }
.preview-table th { font-weight: 600; background: var(--bg); }
.filename { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.new-value { color: var(--success); font-weight: 500; }
.unmatched { opacity: 0.5; }
.batch-apply-bar { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding: 12px; background: var(--bg); border-radius: var(--radius); }
.history-list { display: flex; flex-direction: column; gap: 8px; }
.history-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; }
.history-info { display: flex; gap: 12px; align-items: center; flex: 1; }
.history-field { font-weight: 600; font-size: 13px; min-width: 60px; }
.history-change { font-size: 13px; flex: 1; }
.history-time { font-size: 12px; color: var(--text-light); }
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 500; }
.modal { width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; }
.modal h3 { margin-bottom: 16px; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 4px; }
.form-group small { font-size: 11px; color: var(--text-light); }
.code-input { font-family: monospace; font-size: 13px; }
.mapping-editor { display: flex; flex-direction: column; gap: 6px; }
.mapping-row { display: flex; align-items: center; gap: 8px; }
.group-input { width: 60px; }
.test-result { margin-top: 6px; padding: 8px; background: var(--bg); border-radius: 4px; font-size: 12px; }
.form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
</style>
