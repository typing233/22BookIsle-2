<template>
  <router-link :to="`/book/${book.id}`" class="book-card">
    <div class="cover">
      <img v-if="book.cover_path" :src="coverUrl" :alt="book.title" />
      <div v-else class="cover-placeholder">
        <span class="format-label">{{ book.format.toUpperCase() }}</span>
      </div>
      <label v-if="selectable" class="select-overlay" @click.prevent.stop>
        <input type="checkbox" :checked="selected" @change="$emit('toggle-select', book.id)" />
      </label>
    </div>
    <div class="info">
      <h4 class="title">{{ book.title || '未知标题' }}</h4>
      <p class="author">{{ book.author || '未知作者' }}</p>
      <div v-if="book.user_rating" class="card-rating">
        <span class="stars">{{ '★'.repeat(Math.round(book.user_rating)) }}</span>
      </div>
      <div v-if="book.user_tags && book.user_tags.length" class="card-tags">
        <span
          v-for="tag in book.user_tags.slice(0, 3)"
          :key="tag.id"
          class="mini-tag"
          :style="{ backgroundColor: tag.color || '#e2e8f0' }"
        >{{ tag.name }}</span>
      </div>
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
  selectable?: boolean;
  selected?: boolean;
}>();

defineEmits<{
  'toggle-select': [bookId: number];
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
  position: relative;
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
.select-overlay {
  position: absolute;
  top: 6px; left: 6px;
  width: 20px; height: 20px;
  cursor: pointer;
}
.select-overlay input {
  width: 16px; height: 16px; cursor: pointer;
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
.card-rating {
  margin-top: 4px;
}
.card-rating .stars {
  font-size: 12px;
  color: var(--accent, #f59e0b);
}
.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 4px;
}
.mini-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  color: var(--text-dark);
  font-weight: 500;
}
</style>
