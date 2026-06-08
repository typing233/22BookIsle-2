<template>
  <div class="comic-reader" ref="containerRef" tabindex="0" @keydown="handleKey" @contextmenu.prevent="$emit('contextmenu', $event)">
    <div class="comic-controls">
      <div class="controls-left">
        <button class="btn-secondary btn-sm" :disabled="currentIndex <= 0" @click="goToPrev">上一页</button>
        <span class="page-indicator">{{ displayPageInfo }}</span>
        <button class="btn-secondary btn-sm" :disabled="!canGoNext" @click="goToNext">下一页</button>
      </div>
      <div class="controls-right">
        <button class="btn-secondary btn-sm" :class="{ active: viewMode === 'single' }" @click="setViewMode('single')">单页</button>
        <button class="btn-secondary btn-sm" :class="{ active: viewMode === 'double' }" @click="setViewMode('double')">双页</button>
        <button class="btn-secondary btn-sm" :class="{ active: direction === 'rtl' }" @click="toggleDirection">
          {{ direction === 'ltr' ? 'LTR' : 'RTL' }}
        </button>
      </div>
    </div>
    <div class="comic-container" :class="{ 'spread-mode': viewMode === 'double' }">
      <div class="spread-wrapper" :class="{ rtl: direction === 'rtl' }">
        <div class="comic-page primary" v-if="images.length > 0 && currentIndex < images.length">
          <img :src="images[currentIndex]" :style="{ maxWidth: `${zoom}%` }" @load="onImageLoad(currentIndex)" />
        </div>
        <div
          class="comic-page secondary"
          v-if="viewMode === 'double' && currentIndex + 1 < images.length"
        >
          <img :src="images[currentIndex + 1]" :style="{ maxWidth: `${zoom}%` }" @load="onImageLoad(currentIndex + 1)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';

const props = defineProps<{
  fileUrl: string;
  initialPosition: string;
  zoom: number;
}>();

const emit = defineEmits<{
  'position-change': [payload: { position: string; percentage: number }];
  'contextmenu': [event: MouseEvent];
}>();

const containerRef = ref<HTMLElement | null>(null);
const images = ref<string[]>([]);
const currentIndex = ref(0);
const viewMode = ref<'single' | 'double'>('single');
const direction = ref<'ltr' | 'rtl'>('ltr');

const displayPageInfo = computed(() => {
  if (images.value.length === 0) return '0 / 0';
  if (viewMode.value === 'double' && currentIndex.value + 1 < images.value.length) {
    return `${currentIndex.value + 1}-${currentIndex.value + 2} / ${images.value.length}`;
  }
  return `${currentIndex.value + 1} / ${images.value.length}`;
});

const canGoNext = computed(() => {
  const step = viewMode.value === 'double' ? 2 : 1;
  return currentIndex.value + step < images.value.length;
});

onMounted(async () => {
  try {
    const res = await fetch(props.fileUrl);
    const blob = await res.blob();
    const { BlobReader, ZipReader, BlobWriter } = await import('@zip.js/zip.js');
    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();

    const imageEntries = entries
      .filter((e: any) => /\.(jpe?g|png|gif|webp)$/i.test(e.filename) && !e.directory)
      .sort((a: any, b: any) => a.filename.localeCompare(b.filename));

    for (const entry of imageEntries) {
      const writer = new BlobWriter();
      const data = await (entry as any).getData(writer);
      images.value.push(URL.createObjectURL(data));
    }

    await reader.close();
  } catch (err) {
    console.error('Failed to load CBZ:', err);
  }

  if (props.initialPosition) {
    try {
      const pos = JSON.parse(props.initialPosition);
      if (pos.imageIndex !== undefined) currentIndex.value = pos.imageIndex;
      if (pos.viewMode) viewMode.value = pos.viewMode;
      if (pos.direction) direction.value = pos.direction;
    } catch {}
  }

  containerRef.value?.focus();
});

watch(currentIndex, () => {
  emitPosition();
});

function emitPosition() {
  emit('position-change', {
    position: JSON.stringify({
      imageIndex: currentIndex.value,
      viewMode: viewMode.value,
      direction: direction.value,
    }),
    percentage: images.value.length > 0 ? (currentIndex.value + 1) / images.value.length : 0,
  });
}

function goToNext() {
  const step = viewMode.value === 'double' ? 2 : 1;
  const next = currentIndex.value + step;
  if (next < images.value.length) {
    currentIndex.value = next;
  }
}

function goToPrev() {
  const step = viewMode.value === 'double' ? 2 : 1;
  const prev = currentIndex.value - step;
  if (prev >= 0) {
    currentIndex.value = prev;
  } else {
    currentIndex.value = 0;
  }
}

function goToPage(idx: number) {
  if (idx >= 0 && idx < images.value.length) {
    currentIndex.value = idx;
  }
}

function setViewMode(mode: 'single' | 'double') {
  viewMode.value = mode;
  if (mode === 'double' && currentIndex.value % 2 !== 0) {
    currentIndex.value = Math.max(0, currentIndex.value - 1);
  }
  emitPosition();
}

function toggleDirection() {
  direction.value = direction.value === 'ltr' ? 'rtl' : 'ltr';
  emitPosition();
}

function handleKey(e: KeyboardEvent) {
  const isRtl = direction.value === 'rtl';

  switch (e.key) {
    case 'ArrowLeft':
      isRtl ? goToNext() : goToPrev();
      break;
    case 'ArrowRight':
      isRtl ? goToPrev() : goToNext();
      break;
    case 'ArrowUp':
    case 'PageUp':
      goToPrev();
      break;
    case 'ArrowDown':
    case 'PageDown':
      goToNext();
      break;
    case 'Home':
      currentIndex.value = 0;
      break;
    case 'End':
      currentIndex.value = images.value.length - 1;
      break;
  }
}

function onImageLoad(_idx: number) {}

defineExpose({ goToPage, setViewMode, toggleDirection });
</script>

<style scoped>
.comic-reader { display: flex; flex-direction: column; height: 100%; outline: none; }
.comic-controls {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.controls-left, .controls-right { display: flex; align-items: center; gap: 8px; }
.page-indicator { font-size: 13px; color: var(--text-light); min-width: 80px; text-align: center; }
.btn-sm.active { background: var(--primary); color: white; }
.comic-container {
  flex: 1; overflow-y: auto; display: flex; align-items: center; justify-content: center;
  padding: 8px; background: #1a1a1a;
}
.spread-wrapper {
  display: flex; align-items: center; justify-content: center; gap: 4px;
  max-height: 100%; height: 100%;
}
.spread-wrapper.rtl { flex-direction: row-reverse; }
.comic-page { display: flex; align-items: center; justify-content: center; height: 100%; }
.comic-page img { max-height: 90vh; object-fit: contain; }
.spread-mode .comic-page img { max-height: 90vh; max-width: 50vw; }
</style>
