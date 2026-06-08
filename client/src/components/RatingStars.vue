<template>
  <div class="rating-stars" :class="{ readonly: readonly, interactive: !readonly }">
    <span
      v-for="star in 5"
      :key="star"
      class="star"
      :class="{ filled: star <= Math.round(modelValue), half: star - 0.5 <= modelValue && star > modelValue }"
      :style="{ fontSize: `${size}px` }"
      @click="!readonly && handleClick(star)"
      @mousemove="!readonly && handleHover($event, star)"
      @mouseleave="hoverValue = 0"
    >
      <span class="star-bg">☆</span>
      <span class="star-fill" :style="{ width: getFillWidth(star) + '%' }">★</span>
    </span>
    <span v-if="showValue && modelValue > 0" class="rating-value">{{ modelValue.toFixed(1) }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: number;
  readonly?: boolean;
  size?: number;
  showValue?: boolean;
}>(), {
  readonly: false,
  size: 20,
  showValue: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

const hoverValue = ref(0);

function handleClick(star: number) {
  if (props.readonly) return;
  const newValue = star === Math.round(props.modelValue) ? 0 : star;
  emit('update:modelValue', newValue);
}

function handleHover(event: MouseEvent, star: number) {
  const rect = (event.target as HTMLElement).getBoundingClientRect();
  const x = event.clientX - rect.left;
  const half = x < rect.width / 2;
  hoverValue.value = half ? star - 0.5 : star;
}

function getFillWidth(star: number): number {
  const val = hoverValue.value || props.modelValue;
  if (star <= val) return 100;
  if (star - 1 < val && val < star) return (val - (star - 1)) * 100;
  return 0;
}
</script>

<style scoped>
.rating-stars { display: inline-flex; align-items: center; gap: 2px; }
.star {
  position: relative;
  display: inline-block;
  cursor: default;
  user-select: none;
  line-height: 1;
}
.interactive .star { cursor: pointer; }
.star-bg { color: var(--border); }
.star-fill {
  position: absolute;
  top: 0; left: 0;
  overflow: hidden;
  white-space: nowrap;
  color: var(--accent);
}
.rating-value {
  margin-left: 6px;
  font-size: 13px;
  color: var(--text-light);
  font-weight: 500;
}
</style>
