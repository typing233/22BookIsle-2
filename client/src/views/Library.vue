<template>
  <div class="library-page">
    <div class="library-header">
      <div>
        <h1 class="page-title">{{ library?.name || '加载中...' }}</h1>
        <p class="lib-meta" v-if="library">{{ libraryStore.totalBooks }} 本书籍</p>
      </div>
      <div class="actions">
        <select v-model="sortBy" class="sort-select">
          <option value="title">按标题</option>
          <option value="author">按作者</option>
          <option value="created_at">按添加时间</option>
        </select>
        <select v-model="filterFormat" class="sort-select">
          <option value="">全部格式</option>
          <option value="epub">EPUB</option>
          <option value="pdf">PDF</option>
          <option value="cbz">CBZ</option>
        </select>
        <button class="btn-primary" @click="triggerScan">扫描</button>
      </div>
    </div>

    <div v-if="libraryStore.loading" class="loading">加载中...</div>
    <div v-else-if="libraryStore.books.length" class="grid grid-books">
      <BookCard v-for="book in libraryStore.books" :key="book.id" :book="book" />
    </div>
    <p v-else class="empty">书库为空，请执行扫描</p>

    <div v-if="libraryStore.totalBooks > 20" class="pagination">
      <button
        class="btn-secondary btn-sm"
        :disabled="libraryStore.currentPage <= 1"
        @click="changePage(-1)"
      >上一页</button>
      <span class="page-info">第 {{ libraryStore.currentPage }} 页</span>
      <button
        class="btn-secondary btn-sm"
        :disabled="libraryStore.books.length < 20"
        @click="changePage(1)"
      >下一页</button>
    </div>

    <ScanProgress />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useLibraryStore } from '../stores/library';
import BookCard from '../components/BookCard.vue';
import ScanProgress from '../components/ScanProgress.vue';

const route = useRoute();
const libraryStore = useLibraryStore();

const sortBy = ref('title');
const filterFormat = ref('');
const library = computed(() => libraryStore.currentLibrary);
const libraryId = computed(() => Number(route.params.id));

onMounted(() => loadData());

watch([sortBy, filterFormat], () => loadData());

async function loadData() {
  await libraryStore.fetchLibrary(libraryId.value);
  await libraryStore.fetchBooks({
    library_id: libraryId.value,
    sort: sortBy.value,
    format: filterFormat.value || undefined,
    page: 1,
  });
}

async function triggerScan() {
  try {
    await libraryStore.startScan(libraryId.value);
  } catch (err: any) {
    alert(err.response?.data?.error || '扫描失败');
  }
}

function changePage(delta: number) {
  const newPage = libraryStore.currentPage + delta;
  libraryStore.fetchBooks({
    library_id: libraryId.value,
    sort: sortBy.value,
    format: filterFormat.value || undefined,
    page: newPage,
  });
}
</script>

<style scoped>
.library-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}
.lib-meta { font-size: 14px; color: var(--text-light); }
.actions { display: flex; gap: 8px; align-items: center; }
.sort-select { width: auto; padding: 6px 10px; font-size: 13px; }
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
}
.page-info { font-size: 13px; color: var(--text-light); }
</style>
