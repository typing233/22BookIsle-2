<template>
  <div class="epub-reader" ref="containerRef"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import ePub from 'epubjs';

const props = defineProps<{
  fileUrl: string;
  initialPosition: string;
}>();

const emit = defineEmits<{
  'position-change': [payload: { position: string; percentage: number }];
  'toc-ready': [toc: any[]];
}>();

const containerRef = ref<HTMLElement | null>(null);
let book: any = null;
let rendition: any = null;

onMounted(async () => {
  if (!containerRef.value) return;

  book = ePub(props.fileUrl);
  rendition = book.renderTo(containerRef.value, {
    width: '100%',
    height: '100%',
    spread: 'none',
    flow: 'scrolled-doc',
  });

  rendition.on('relocated', (location: any) => {
    const cfi = location.start.cfi;
    const pct = book.locations ? (location.start.percentage || 0) : 0;
    emit('position-change', {
      position: JSON.stringify({ cfi, percentage: pct }),
      percentage: pct,
    });
  });

  book.ready.then(() => {
    const toc = book.navigation?.toc || [];
    const flatToc = toc.map((item: any) => ({
      label: item.label?.trim(),
      href: item.href,
      level: item.level || 0,
    }));
    emit('toc-ready', flatToc);
  });

  await book.ready;
  await book.locations.generate(1600);

  if (props.initialPosition) {
    try {
      const pos = JSON.parse(props.initialPosition);
      if (pos.cfi) {
        await rendition.display(pos.cfi);
        return;
      }
    } catch {}
  }

  await rendition.display();
});

onBeforeUnmount(() => {
  if (book) book.destroy();
});

function goTo(target: string) {
  if (rendition) rendition.display(target);
}

defineExpose({ goTo });
</script>

<style scoped>
.epub-reader {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
