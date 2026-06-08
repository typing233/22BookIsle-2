<template>
  <div class="admin-page">
    <h1 class="page-title">系统管理</h1>

    <div class="tabs">
      <button :class="{ active: tab === 'users' }" @click="tab = 'users'">用户管理</button>
      <button :class="{ active: tab === 'libraries' }" @click="tab = 'libraries'">书库管理</button>
      <button :class="{ active: tab === 'audit' }" @click="tab = 'audit'">审计日志</button>
    </div>

    <!-- Users -->
    <section v-if="tab === 'users'" class="card">
      <div class="section-header">
        <h2>用户列表</h2>
        <button class="btn-primary btn-sm" @click="showUserForm = true">+ 新建用户</button>
      </div>
      <table class="data-table">
        <thead>
          <tr><th>用户名</th><th>显示名</th><th>角色</th><th>创建时间</th><th>操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.username }}</td>
            <td>{{ u.display_name || '-' }}</td>
            <td><span class="badge" :class="`badge-${u.role}`">{{ u.role }}</span></td>
            <td>{{ formatDate(u.created_at) }}</td>
            <td>
              <button class="btn-danger btn-sm" @click="deleteUser(u.id)" v-if="u.role !== 'admin'">删除</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="showUserForm" class="modal-overlay" @click.self="showUserForm = false">
        <div class="modal card">
          <h3>新建用户</h3>
          <form @submit.prevent="createUser">
            <div class="form-group"><label>用户名</label><input v-model="newUser.username" /></div>
            <div class="form-group"><label>密码</label><input v-model="newUser.password" type="password" /></div>
            <div class="form-group"><label>显示名</label><input v-model="newUser.display_name" /></div>
            <div class="form-group">
              <label>角色</label>
              <select v-model="newUser.role"><option value="user">普通用户</option><option value="admin">管理员</option></select>
            </div>
            <div class="form-actions">
              <button type="button" class="btn-secondary" @click="showUserForm = false">取消</button>
              <button type="submit" class="btn-primary">创建</button>
            </div>
          </form>
        </div>
      </div>
    </section>

    <!-- Libraries -->
    <section v-if="tab === 'libraries'" class="card">
      <div class="section-header">
        <h2>书库列表</h2>
        <button class="btn-primary btn-sm" @click="showLibForm = true">+ 新建书库</button>
      </div>
      <table class="data-table">
        <thead>
          <tr><th>名称</th><th>路径</th><th>定时扫描</th><th>上次扫描</th><th>操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="lib in libraries" :key="lib.id">
            <td>{{ lib.name }}</td>
            <td><code>{{ lib.paths.join(', ') }}</code></td>
            <td>{{ lib.scan_schedule || '手动' }}</td>
            <td>{{ lib.last_scan_at ? formatDate(lib.last_scan_at) : '未扫描' }}</td>
            <td>
              <button class="btn-primary btn-sm" @click="scanLibrary(lib.id)">扫描</button>
              <button class="btn-danger btn-sm" @click="deleteLibrary(lib.id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="showLibForm" class="modal-overlay" @click.self="showLibForm = false">
        <div class="modal card">
          <h3>新建书库</h3>
          <form @submit.prevent="createLibrary">
            <div class="form-group"><label>名称</label><input v-model="newLib.name" /></div>
            <div class="form-group"><label>路径 (每行一个)</label><textarea v-model="newLib.pathsText" rows="3"></textarea></div>
            <div class="form-group"><label>定时扫描 (cron表达式, 可选)</label><input v-model="newLib.scan_schedule" placeholder="0 2 * * *" /></div>
            <div class="form-actions">
              <button type="button" class="btn-secondary" @click="showLibForm = false">取消</button>
              <button type="submit" class="btn-primary">创建</button>
            </div>
          </form>
        </div>
      </div>
    </section>

    <!-- Audit -->
    <section v-if="tab === 'audit'" class="card">
      <h2>审计日志</h2>
      <table class="data-table">
        <thead>
          <tr><th>时间</th><th>用户</th><th>操作</th><th>目标</th><th>详情</th></tr>
        </thead>
        <tbody>
          <tr v-for="entry in auditLog" :key="entry.id">
            <td>{{ formatDate(entry.created_at) }}</td>
            <td>{{ entry.user_id || '-' }}</td>
            <td><span class="badge">{{ entry.action }}</span></td>
            <td>{{ entry.target_type }} #{{ entry.target_id }}</td>
            <td class="details-cell">{{ truncate(entry.details, 50) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../api/client';
import { useLibraryStore } from '../stores/library';

const libraryStore = useLibraryStore();
const tab = ref('users');
const users = ref<any[]>([]);
const libraries = ref<any[]>([]);
const auditLog = ref<any[]>([]);
const showUserForm = ref(false);
const showLibForm = ref(false);

const newUser = ref({ username: '', password: '', display_name: '', role: 'user' });
const newLib = ref({ name: '', pathsText: '', scan_schedule: '' });

onMounted(async () => {
  await loadData();
});

async function loadData() {
  const [usersRes, libsRes, auditRes] = await Promise.all([
    api.get('/users'),
    api.get('/libraries'),
    api.get('/audit'),
  ]);
  users.value = usersRes.data;
  libraries.value = libsRes.data;
  auditLog.value = auditRes.data.data;
}

async function createUser() {
  await api.post('/users', newUser.value);
  showUserForm.value = false;
  newUser.value = { username: '', password: '', display_name: '', role: 'user' };
  const res = await api.get('/users');
  users.value = res.data;
}

async function deleteUser(id: number) {
  if (!confirm('确定删除该用户?')) return;
  await api.delete(`/users/${id}`);
  users.value = users.value.filter((u) => u.id !== id);
}

async function createLibrary() {
  const paths = newLib.value.pathsText.split('\n').map((p) => p.trim()).filter(Boolean);
  await api.post('/libraries', { name: newLib.value.name, paths, scan_schedule: newLib.value.scan_schedule || undefined });
  showLibForm.value = false;
  newLib.value = { name: '', pathsText: '', scan_schedule: '' };
  const res = await api.get('/libraries');
  libraries.value = res.data;
}

async function deleteLibrary(id: number) {
  if (!confirm('确定删除该书库? 所有相关书籍数据将丢失。')) return;
  await api.delete(`/libraries/${id}`);
  libraries.value = libraries.value.filter((l) => l.id !== id);
}

async function scanLibrary(id: number) {
  try {
    await libraryStore.startScan(id);
    alert('扫描已启动');
  } catch (err: any) {
    alert(err.response?.data?.error || '扫描失败');
  }
}

function formatDate(str: string): string {
  if (!str) return '-';
  return new Date(str).toLocaleString('zh-CN');
}

function truncate(str: string | null, len: number): string {
  if (!str) return '-';
  return str.length > len ? str.slice(0, len) + '...' : str;
}
</script>

<style scoped>
.tabs { display: flex; gap: 4px; margin-bottom: 20px; }
.tabs button {
  padding: 8px 16px; background: var(--border); border-radius: var(--radius);
  font-size: 14px; color: var(--text);
}
.tabs button.active { background: var(--primary); color: white; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-header h2 { font-size: 16px; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th, .data-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); }
.data-table th { font-weight: 600; color: var(--text-light); font-size: 12px; text-transform: uppercase; }
.details-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 500;
}
.modal { width: 100%; max-width: 420px; }
.modal h3 { margin-bottom: 16px; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 4px; }
.form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
</style>
