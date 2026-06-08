<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal card batch-modal">
      <h3>批量编辑 ({{ bookIds.length }} 本书)</h3>

      <div class="form-group">
        <label>评分</label>
        <div class="batch-rating">
          <label class="checkbox-label">
            <input type="checkbox" v-model="applyRating" /> 设置评分
          </label>
          <RatingStars v-if="applyRating" v-model="rating" :size="24" />
        </div>
      </div>

      <div class="form-group">
        <label>添加标签</label>
        <div class="tag-checkboxes">
          <label v-for="tag in allTags" :key="tag.id" class="checkbox-label">
            <input type="checkbox" :value="tag.id" v-model="addTagIds" />
            <span class="tag-dot" :style="{ background: tag.color || '#e2e8f0' }"></span>
            {{ tag.name }}
          </label>
        </div>
      </div>

      <div class="form-group">
        <label>移除标签</label>
        <div class="tag-checkboxes">
          <label v-for="tag in allTags" :key="tag.id" class="checkbox-label">
            <input type="checkbox" :value="tag.id" v-model="removeTagIds" />
            <span class="tag-dot" :style="{ background: tag.color || '#e2e8f0' }"></span>
            {{ tag.name }}
          </label>
        </div>
      </div>

      <div class="form-actions">
        <button class="btn-secondary" @click="$emit('close')">取消</button>
        <button class="btn-primary" @click="handleApply" :disabled="loading">
          {{ loading ? '处理中...' : '应用' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import RatingStars from './RatingStars.vue';
import { useTagsStore, type Tag } from '../stores/tags';

const props = defineProps<{
  bookIds: number[];
  allTags: Tag[];
}>();

const emit = defineEmits<{
  'close': [];
  'applied': [];
}>();

const tagsStore = useTagsStore();
const applyRating = ref(false);
const rating = ref(0);
const addTagIds = ref<number[]>([]);
const removeTagIds = ref<number[]>([]);
const loading = ref(false);

async function handleApply() {
  loading.value = true;
  try {
    if (applyRating.value && rating.value > 0) {
      await tagsStore.batchRate(props.bookIds, rating.value);
    }
    if (addTagIds.value.length > 0 || removeTagIds.value.length > 0) {
      await tagsStore.batchTag(
        props.bookIds,
        addTagIds.value.length > 0 ? addTagIds.value : undefined,
        removeTagIds.value.length > 0 ? removeTagIds.value : undefined
      );
    }
    emit('applied');
    emit('close');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.batch-modal { width: 100%; max-width: 480px; }
.batch-modal h3 { margin-bottom: 16px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; }
.batch-rating { display: flex; flex-direction: column; gap: 8px; }
.tag-checkboxes { display: flex; flex-wrap: wrap; gap: 8px; }
.checkbox-label {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 13px; cursor: pointer;
}
.tag-dot { width: 10px; height: 10px; border-radius: 50%; }
.form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 500;
}
</style>
