<template>
  <router-link :to="`/book/${book.id}`" class="book-card">
    <div class="cover">
      <img v-if="book.cover_path" :src="coverUrl" :alt="book.title" />
      <div v-else class="cover-placeholder">
        <span class="format-label">{{ book.format.toUpperCase() }}</span>
      </div>
    </div>
    <div class="info">
      <h4 class="title">{{ book.title || '未知标题' }}</h4>
      <p class="author">{{ book.author || '未知作者' }}</p>
      <div v-if="showProgress && book.percentage" class="progress-bar">
        <div class="progress-bar-fill" :style="{ width: `${book.percentage * 100}%` }"></div>
      </div>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { authUrl } from '../utils/authUrl';

const props = defineProps<{
  book: any;
  showProgress?: boolean;
}>();

const coverUrl = computed(() => authUrl(`/api/books/${props.book.id}/cover`));
</script>

<style scoped>
.book-card {
  display: block;
  background: var(--bg-card);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow);
  transition: transform 0.2s, box-shadow 0.2s;
}
.book-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.cover {
  aspect-ratio: 3/4;
  overflow: hidden;
  background: #e8e8e8;
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.format-label {
  color: white;
  font-weight: 700;
  font-size: 18px;
}

.info {
  padding: 10px;
}
.title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.author {
  font-size: 12px;
  color: var(--text-light);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
