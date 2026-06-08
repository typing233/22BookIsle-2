<template>
  <div class="comic-reader">
    <div class="comic-controls">
      <button class="btn-secondary btn-sm" :disabled="currentIndex <= 0" @click="goToPage(currentIndex - 1)">上一页</button>
      <span class="page-indicator">{{ currentIndex + 1 }} / {{ images.length }}</span>
      <button class="btn-secondary btn-sm" :disabled="currentIndex >= images.length - 1" @click="goToPage(currentIndex + 1)">下一页</button>
    </div>
    <div class="comic-container" ref="containerRef" @keydown="handleKey">
      <div
        v-for="(img, idx) in images"
        :key="idx"
        class="comic-page"
        :class="{ active: idx === currentIndex }"
      >
        <img
          v-if="Math.abs(idx - currentIndex) <= 2"
          :src="img"
          :style="{ maxWidth: `${zoom}%` }"
          @load="onImageLoad(idx)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

const props = defineProps<{
  fileUrl: string;
  initialPosition: string;
  zoom: number;
}>();

const emit = defineEmits<{
  'position-change': [payload: { position: string; percentage: number }];
}>();

const containerRef = ref<HTMLElement | null>(null);
const images = ref<string[]>([]);
const currentIndex = ref(0);

onMounted(async () => {
  try {
    const res = await fetch(props.fileUrl);
    const blob = await res.blob();
    const { BlobReader, ZipReader, BlobWriter } = await import('@zip.js/zip.js');
    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();

    const imageEntries = entries
      .filter((e: any) => /\.(jpe?g|png|gif|webp)$/i.test(e.filename))
      .sort((a: any, b: any) => a.filename.localeCompare(b.filename));

    for (const entry of imageEntries) {
      const blob = await entry.getData!(new BlobWriter());
      images.value.push(URL.createObjectURL(blob));
    }

    await reader.close();
  } catch (err) {
    console.error('Failed to load CBZ:', err);
  }

  if (props.initialPosition) {
    try {
      const pos = JSON.parse(props.initialPosition);
      if (pos.imageIndex !== undefined) currentIndex.value = pos.imageIndex;
    } catch {}
  }
});

watch(currentIndex, () => {
  emit('position-change', {
    position: JSON.stringify({ imageIndex: currentIndex.value }),
    percentage: images.value.length > 0 ? (currentIndex.value + 1) / images.value.length : 0,
  });
  scrollToCurrentPage();
});

function goToPage(idx: number) {
  if (idx >= 0 && idx < images.value.length) {
    currentIndex.value = idx;
  }
}

function scrollToCurrentPage() {
  const container = containerRef.value;
  if (!container) return;
  const page = container.querySelector('.comic-page.active');
  if (page) page.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function handleKey(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goToPage(currentIndex.value - 1);
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goToPage(currentIndex.value + 1);
}

function onImageLoad(_idx: number) {}

defineExpose({ goToPage });
</script>

<style scoped>
.comic-reader { display: flex; flex-direction: column; height: 100%; }
.comic-controls {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  padding: 8px; border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.page-indicator { font-size: 13px; color: var(--text-light); }
.comic-container {
  flex: 1; overflow-y: auto; display: flex; flex-direction: column; align-items: center;
  padding: 8px; outline: none;
}
.comic-page { display: none; }
.comic-page.active { display: block; }
.comic-page img { max-height: 90vh; object-fit: contain; }
</style>
