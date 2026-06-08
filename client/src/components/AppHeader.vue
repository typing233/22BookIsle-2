<template>
  <header class="app-header">
    <div class="header-left">
      <router-link to="/" class="logo">BookIsle</router-link>
      <nav class="nav-links">
        <router-link to="/">首页</router-link>
        <router-link to="/admin" v-if="authStore.isAdmin">管理</router-link>
      </nav>
    </div>
    <div class="header-right">
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索书籍..."
          @keyup.enter="doSearch"
        />
      </div>
      <div class="user-menu">
        <span class="username">{{ authStore.user?.display_name || authStore.user?.username }}</span>
        <button class="btn-secondary btn-sm" @click="authStore.logout(); $router.push('/login')">
          退出
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const router = useRouter();
const searchQuery = ref('');

function doSearch() {
  if (searchQuery.value.trim()) {
    router.push({ path: '/', query: { q: searchQuery.value.trim() } });
  }
}
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: white;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.logo {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary);
}

.nav-links {
  display: flex;
  gap: 16px;
}

.nav-links a {
  color: var(--text-light);
  font-size: 14px;
}
.nav-links a.router-link-active {
  color: var(--primary);
  font-weight: 500;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.search-box input {
  width: 240px;
  padding: 6px 12px;
  font-size: 13px;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 10px;
}

.username {
  font-size: 13px;
  color: var(--text-light);
}
</style>
