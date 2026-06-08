<template>
  <div class="book-detail" v-if="book">
    <div class="book-layout">
      <div class="cover-section">
        <div class="cover-large">
          <img v-if="book.cover_path" :src="`/api/books/${book.id}/cover`" :alt="book.title" />
          <div v-else class="cover-placeholder">
            <span>{{ book.format.toUpperCase() }}</span>
          </div>
        </div>
        <button class="btn-primary read-btn" @click="openReader">
          {{ book.progress ? '继续阅读' : '开始阅读' }}
        </button>
      </div>
      <div class="meta-section">
        <h1>{{ book.title || '未知标题' }}</h1>
        <p class="author">{{ book.author || '未知作者' }}</p>
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">格式</span>
            <span class="badge" :class="`badge-${book.format}`">{{ book.format.toUpperCase() }}</span>
          </div>
          <div class="meta-item" v-if="book.page_count">
            <span class="meta-label">页数</span>
            <span>{{ book.page_count }}</span>
          </div>
          <div class="meta-item" v-if="book.publisher">
            <span class="meta-label">出版社</span>
            <span>{{ book.publisher }}</span>
          </div>
          <div class="meta-item" v-if="book.language">
            <span class="meta-label">语言</span>
            <span>{{ book.language }}</span>
          </div>
          <div class="meta-item" v-if="book.file_size">
            <span class="meta-label">文件大小</span>
            <span>{{ formatSize(book.file_size) }}</span>
          </div>
        </div>
        <div v-if="book.progress" class="reading-progress">
          <p class="progress-label">阅读进度: {{ Math.round(book.progress.percentage * 100) }}%</p>
          <div class="progress-bar">
            <div class="progress-bar-fill" :style="{ width: `${book.progress.percentage * 100}%` }"></div>
          </div>
        </div>
        <div v-if="book.description" class="description">
          <h3>简介</h3>
          <p>{{ book.description }}</p>
        </div>
      </div>
    </div>

    <section v-if="bookmarks.length" class="bookmarks-section">
      <h3>书签与批注</h3>
      <div class="bookmarks-list">
        <div v-for="bm in bookmarks" :key="bm.id" class="bookmark-item">
          <span class="bm-type badge">{{ bm.type }}</span>
          <span class="bm-label">{{ bm.label || bm.note || '未命名' }}</span>
          <button class="btn-danger btn-sm" @click="deleteBookmark(bm.id)">删除</button>
        </div>
      </div>
    </section>
  </div>
  <div v-else class="loading">加载中...</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useReaderStore } from '../stores/reader';

const route = useRoute();
const router = useRouter();
const readerStore = useReaderStore();

const book = ref<any>(null);
const bookmarks = ref<any[]>([]);

const bookId = Number(route.params.id);

onMounted(async () => {
  await readerStore.fetchBook(bookId);
  book.value = readerStore.currentBook;
  await readerStore.fetchBookmarks(bookId);
  bookmarks.value = readerStore.bookmarks;
});

function openReader() {
  router.push(`/read/${bookId}`);
}

async function deleteBookmark(id: number) {
  await readerStore.removeBookmark(id);
  bookmarks.value = readerStore.bookmarks;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
</script>

<style scoped>
.book-layout { display: flex; gap: 32px; }
.cover-section { flex-shrink: 0; width: 240px; }
.cover-large {
  aspect-ratio: 3/4;
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  margin-bottom: 16px;
}
.cover-large img { width: 100%; height: 100%; object-fit: cover; }
.cover-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white; font-size: 24px; font-weight: 700;
}
.read-btn { width: 100%; padding: 12px; font-size: 16px; }
.meta-section { flex: 1; }
.meta-section h1 { font-size: 24px; margin-bottom: 4px; }
.author { color: var(--text-light); font-size: 16px; margin-bottom: 20px; }
.meta-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px; }
.meta-item { font-size: 14px; }
.meta-label { display: block; font-size: 12px; color: var(--text-light); margin-bottom: 2px; }
.reading-progress { margin-bottom: 20px; }
.progress-label { font-size: 13px; color: var(--text-light); margin-bottom: 6px; }
.description { margin-top: 20px; }
.description h3 { font-size: 16px; margin-bottom: 8px; }
.description p { font-size: 14px; color: var(--text); line-height: 1.7; }
.bookmarks-section { margin-top: 32px; }
.bookmarks-section h3 { font-size: 16px; margin-bottom: 12px; }
.bookmarks-list { display: flex; flex-direction: column; gap: 8px; }
.bookmark-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--bg-card); border-radius: var(--radius); }
.bm-label { flex: 1; font-size: 14px; }

@media (max-width: 768px) {
  .book-layout { flex-direction: column; }
  .cover-section { width: 160px; margin: 0 auto; }
}
</style>
