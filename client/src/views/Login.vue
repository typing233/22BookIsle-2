<template>
  <div class="login-page">
    <div class="login-card card">
      <h1>BookIsle</h1>
      <p class="subtitle">个人电子书库管理</p>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label>用户名</label>
          <input v-model="username" type="text" placeholder="请输入用户名" autofocus />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="password" type="password" placeholder="请输入密码" />
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" class="btn-primary login-btn" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const router = useRouter();

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleLogin() {
  error.value = '';
  loading.value = true;

  const success = await authStore.login(username.value, password.value);
  loading.value = false;

  if (success) {
    router.push('/');
  } else {
    error.value = '用户名或密码错误';
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 100%;
  max-width: 380px;
  padding: 40px;
  text-align: center;
}

.login-card h1 {
  font-size: 28px;
  color: var(--primary);
  margin-bottom: 4px;
}

.subtitle {
  color: var(--text-light);
  margin-bottom: 32px;
  font-size: 14px;
}

.form-group {
  margin-bottom: 16px;
  text-align: left;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--text);
}

.error {
  color: var(--danger);
  font-size: 13px;
  margin-bottom: 12px;
}

.login-btn {
  width: 100%;
  padding: 10px;
  font-size: 15px;
  margin-top: 8px;
}
</style>
