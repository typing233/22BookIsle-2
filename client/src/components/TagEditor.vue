<template>
  <div class="tag-editor">
    <div class="tag-list">
      <span
        v-for="tag in currentTags"
        :key="tag.id"
        class="tag-chip"
        :style="{ backgroundColor: tag.color || '#e2e8f0' }"
      >
        {{ tag.name }}
        <button v-if="!readonly" class="tag-remove" @click="removeTag(tag.id)">&times;</button>
      </span>
    </div>
    <div v-if="!readonly" class="tag-input-wrapper">
      <input
        v-model="inputValue"
        class="tag-input"
        placeholder="输入标签名..."
        @keydown.enter.prevent="handleEnter"
        @focus="showSuggestions = true"
        @blur="onBlur"
      />
      <div v-if="showSuggestions && filteredSuggestions.length > 0" class="tag-suggestions">
        <div
          v-for="tag in filteredSuggestions"
          :key="tag.id"
          class="tag-suggestion-item"
          @mousedown.prevent="selectTag(tag)"
        >
          <span class="suggestion-color" :style="{ background: tag.color || '#e2e8f0' }"></span>
          {{ tag.name }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Tag } from '../stores/tags';

const props = withDefaults(defineProps<{
  modelValue: Tag[];
  allTags: Tag[];
  readonly?: boolean;
}>(), {
  readonly: false,
});

const emit = defineEmits<{
  'update:modelValue': [tags: Tag[]];
  'create-tag': [name: string];
  'add-tag': [tagId: number];
  'remove-tag': [tagId: number];
}>();

const inputValue = ref('');
const showSuggestions = ref(false);

const currentTags = computed(() => props.modelValue);

const filteredSuggestions = computed(() => {
  if (!inputValue.value.trim()) return props.allTags.filter((t) => !currentTags.value.find((ct) => ct.id === t.id));
  const q = inputValue.value.toLowerCase();
  return props.allTags.filter(
    (t) => t.name.toLowerCase().includes(q) && !currentTags.value.find((ct) => ct.id === t.id)
  );
});

function selectTag(tag: Tag) {
  emit('add-tag', tag.id);
  emit('update:modelValue', [...currentTags.value, tag]);
  inputValue.value = '';
  showSuggestions.value = false;
}

function removeTag(tagId: number) {
  emit('remove-tag', tagId);
  emit('update:modelValue', currentTags.value.filter((t) => t.id !== tagId));
}

function handleEnter() {
  const name = inputValue.value.trim();
  if (!name) return;

  const existing = props.allTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    selectTag(existing);
  } else {
    emit('create-tag', name);
    inputValue.value = '';
  }
}

function onBlur() {
  setTimeout(() => { showSuggestions.value = false; }, 200);
}
</script>

<style scoped>
.tag-editor { display: flex; flex-direction: column; gap: 8px; }
.tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
.tag-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 10px; border-radius: 12px; font-size: 12px;
  color: var(--text-dark); font-weight: 500;
}
.tag-remove {
  background: none; border: none; cursor: pointer; font-size: 14px;
  line-height: 1; padding: 0 2px; opacity: 0.6;
}
.tag-remove:hover { opacity: 1; }
.tag-input-wrapper { position: relative; }
.tag-input {
  width: 100%; padding: 6px 10px; font-size: 13px;
  border: 1px solid var(--border); border-radius: var(--radius);
}
.tag-suggestions {
  position: absolute; top: 100%; left: 0; right: 0;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow-lg);
  max-height: 200px; overflow-y: auto; z-index: 100;
}
.tag-suggestion-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; cursor: pointer; font-size: 13px;
}
.tag-suggestion-item:hover { background: var(--bg); }
.suggestion-color { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
</style>
