<template>
  <div class="dashboard">
    <section v-if="searchQuery">
      <h2 class="page-title">搜索结果: "{{ searchQuery }}"</h2>
      <div v-if="searchResults.length" class="grid grid-books">
        <BookCard v-for="book in searchResults" :key="book.id" :book="book" />
      </div>
      <p v-else class="empty">未找到相关书籍</p>
    </section>

    <template v-else>
      <section v-if="readingHistory.length" class="section">
        <h2 class="section-title">继续阅读</h2>
        <div class="grid grid-books">
          <BookCard v-for="book in readingHistory.slice(0, 6)" :key="book.id" :book="book" :show-progress="true" />
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">我的书库</h2>
        </div>
        <div v-if="libraryStore.libraries.length" class="library-grid">
          <router-link
            v-for="lib in libraryStore.libraries"
            :key="lib.id"
            :to="`/library/${lib.id}`"
            class="library-card card"
          >
            <h3>{{ lib.name }}</h3>
            <p class="lib-info">{{ lib.paths.length }} 个目录</p>
          </router-link>
        </div>
        <p v-else class="empty">暂无书库，请管理员添加</p>
      </section>

      <section v-if="recentBooks.length" class="section">
        <h2 class="section-title">最近添加</h2>
        <div class="grid grid-books">
          <BookCard v-for="book in recentBooks" :key="book.id" :book="book" />
        </div>
      </section>
    </template>

    <ScanProgress />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import api from '../api/client';
import { useLibraryStore } from '../stores/library';
import BookCard from '../components/BookCard.vue';
import ScanProgress from '../components/ScanProgress.vue';

const route = useRoute();
const libraryStore = useLibraryStore();
const readingHistory = ref<any[]>([]);
const recentBooks = ref<any[]>([]);
const searchResults = ref<any[]>([]);
const searchQuery = ref('');

onMounted(async () => {
  await libraryStore.fetchLibraries();
  const [historyRes, recentRes] = await Promise.all([
    api.get('/progress'),
    api.get('/books', { params: { sort: 'created_at', order: 'desc', limit: 12 } }),
  ]);
  readingHistory.value = historyRes.data;
  recentBooks.value = recentRes.data.data;
});

watch(() => route.query.q, async (q) => {
  searchQuery.value = (q as string) || '';
  if (searchQuery.value) {
    const res = await api.get('/search', { params: { q: searchQuery.value } });
    searchResults.value = res.data.data;
  } else {
    searchResults.value = [];
  }
}, { immediate: true });
</script>

<style scoped>
.section { margin-bottom: 32px; }
.section-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}
.library-card {
  display: block;
  transition: transform 0.2s, box-shadow 0.2s;
}
.library-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
.library-card h3 { font-size: 16px; margin-bottom: 4px; color: var(--text-dark); }
.lib-info { font-size: 13px; color: var(--text-light); }
</style>
