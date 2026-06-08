<template>
  <div class="pdf-reader">
    <div class="pdf-controls">
      <button class="btn-secondary btn-sm" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">上一页</button>
      <span class="page-indicator">{{ currentPage }} / {{ totalPages }}</span>
      <button class="btn-secondary btn-sm" :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">下一页</button>
    </div>
    <div class="pdf-container" ref="containerRef">
      <canvas
        v-for="pageNum in visiblePages"
        :key="pageNum"
        :ref="(el) => setCanvasRef(el, pageNum)"
        class="pdf-page"
      ></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, nextTick } from 'vue';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const props = defineProps<{
  fileUrl: string;
  initialPosition: string;
  zoom: number;
}>();

const emit = defineEmits<{
  'position-change': [payload: { position: string; percentage: number }];
  'toc-ready': [toc: any[]];
}>();

const containerRef = ref<HTMLElement | null>(null);
const currentPage = ref(1);
const totalPages = ref(0);
const canvasRefs = new Map<number, HTMLCanvasElement>();

let pdfDoc: any = null;

const visiblePages = computed(() => {
  const pages: number[] = [];
  const start = Math.max(1, currentPage.value - 1);
  const end = Math.min(totalPages.value, currentPage.value + 2);
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
});

function setCanvasRef(el: any, pageNum: number) {
  if (el) canvasRefs.set(pageNum, el as HTMLCanvasElement);
}

onMounted(async () => {
  const loadingTask = pdfjsLib.getDocument(props.fileUrl);
  pdfDoc = await loadingTask.promise;
  totalPages.value = pdfDoc.numPages;

  if (props.initialPosition) {
    try {
      const pos = JSON.parse(props.initialPosition);
      if (pos.page) currentPage.value = pos.page;
    } catch {}
  }

  emit('toc-ready', await extractOutline());
  await nextTick();
  renderVisiblePages();
});

watch(currentPage, async () => {
  await nextTick();
  renderVisiblePages();
  emit('position-change', {
    position: JSON.stringify({ page: currentPage.value }),
    percentage: currentPage.value / totalPages.value,
  });
});

watch(() => props.zoom, () => renderVisiblePages());

async function renderVisiblePages() {
  for (const pageNum of visiblePages.value) {
    const canvas = canvasRefs.get(pageNum);
    if (!canvas || !pdfDoc) continue;

    const page = await pdfDoc.getPage(pageNum);
    const scale = (props.zoom / 100) * 1.5;
    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, viewport }).promise;
  }
}

async function extractOutline(): Promise<any[]> {
  if (!pdfDoc) return [];
  try {
    const outline = await pdfDoc.getOutline();
    if (!outline) return [];
    return outline.map((item: any) => ({
      label: item.title,
      page: 1,
      level: 0,
    }));
  } catch {
    return [];
  }
}

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
}

defineExpose({ goToPage });
</script>

<style scoped>
.pdf-reader { display: flex; flex-direction: column; height: 100%; }
.pdf-controls {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  padding: 8px; border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.page-indicator { font-size: 13px; color: var(--text-light); }
.pdf-container {
  flex: 1; overflow-y: auto; display: flex; flex-direction: column; align-items: center;
  padding: 16px; gap: 16px;
}
.pdf-page { box-shadow: var(--shadow); max-width: 100%; }
</style>
