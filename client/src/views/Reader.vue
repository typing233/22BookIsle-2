<template>
  <div class="reader-page" v-if="book">
    <ReaderToolbar
      :book="book"
      :percentage="percentage"
      :show-toc="showToc"
      @toggle-toc="showToc = !showToc"
      @add-bookmark="handleAddBookmark"
      @zoom-in="zoomLevel += 10"
      @zoom-out="zoomLevel -= 10"
      @back="$router.back()"
    />

    <div class="reader-body">
      <TOCSidebar
        v-if="showToc"
        :toc="toc"
        @navigate="handleTocNavigate"
        @close="showToc = false"
      />

      <div class="reader-content" :style="{ fontSize: `${zoomLevel}%` }">
        <EpubReader
          v-if="book.format === 'epub'"
          :file-url="fileUrl"
          :initial-position="savedPosition"
          @position-change="handlePositionChange"
          @toc-ready="toc = $event"
          ref="epubRef"
        />
        <PdfReader
          v-else-if="book.format === 'pdf'"
          :file-url="fileUrl"
          :initial-position="savedPosition"
          :zoom="zoomLevel"
          @position-change="handlePositionChange"
          @toc-ready="toc = $event"
          ref="pdfRef"
        />
        <ComicReader
          v-else-if="book.format === 'cbz'"
          :file-url="fileUrl"
          :initial-position="savedPosition"
          :zoom="zoomLevel"
          @position-change="handlePositionChange"
          ref="comicRef"
        />
      </div>

      <BookmarkPanel
        v-if="showBookmarks"
        :bookmarks="bookmarks"
        @navigate="handleBookmarkNavigate"
        @delete="handleDeleteBookmark"
        @close="showBookmarks = false"
      />
    </div>
  </div>
  <div v-else class="loading">加载中...</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useReaderStore } from '../stores/reader';
import ReaderToolbar from '../components/ReaderToolbar.vue';
import TOCSidebar from '../components/TOCSidebar.vue';
import BookmarkPanel from '../components/BookmarkPanel.vue';
import EpubReader from '../readers/EpubReader.vue';
import PdfReader from '../readers/PdfReader.vue';
import ComicReader from '../readers/ComicReader.vue';

const route = useRoute();
const readerStore = useReaderStore();
const bookId = Number(route.params.id);

const book = ref<any>(null);
const toc = ref<any[]>([]);
const showToc = ref(false);
const showBookmarks = ref(false);
const zoomLevel = ref(100);
const percentage = ref(0);
const savedPosition = ref('');

const epubRef = ref<any>(null);
const pdfRef = ref<any>(null);
const comicRef = ref<any>(null);

const bookmarks = computed(() => readerStore.bookmarks);
const fileUrl = computed(() => readerStore.getFileUrl(bookId));

let saveTimer: any = null;

onMounted(async () => {
  await readerStore.fetchBook(bookId);
  book.value = readerStore.currentBook;
  savedPosition.value = readerStore.position;
  percentage.value = readerStore.percentage;
  await readerStore.fetchBookmarks(bookId);
});

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer);
  saveCurrentPosition();
});

function handlePositionChange(pos: { position: string; percentage: number }) {
  percentage.value = pos.percentage;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    readerStore.saveProgress(bookId, pos.position, pos.percentage);
  }, 2000);
}

function saveCurrentPosition() {
  if (percentage.value > 0) {
    readerStore.saveProgress(bookId, readerStore.position, percentage.value);
  }
}

async function handleAddBookmark() {
  const position = readerStore.position;
  await readerStore.addBookmark({
    book_id: bookId,
    position,
    type: 'bookmark',
    label: `书签 - ${Math.round(percentage.value * 100)}%`,
  });
}

function handleTocNavigate(item: any) {
  if (book.value?.format === 'epub' && epubRef.value) {
    epubRef.value.goTo(item.href);
  } else if (book.value?.format === 'pdf' && pdfRef.value) {
    pdfRef.value.goToPage(item.page);
  }
  showToc.value = false;
}

function handleBookmarkNavigate(bm: any) {
  const pos = JSON.parse(bm.position);
  if (book.value?.format === 'epub' && epubRef.value) {
    epubRef.value.goTo(pos.cfi || pos);
  } else if (book.value?.format === 'pdf' && pdfRef.value) {
    pdfRef.value.goToPage(pos.page);
  } else if (comicRef.value) {
    comicRef.value.goToPage(pos.imageIndex);
  }
  showBookmarks.value = false;
}

async function handleDeleteBookmark(id: number) {
  await readerStore.removeBookmark(id);
}
</script>

<style scoped>
.reader-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: white;
}
.reader-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.reader-content {
  flex: 1;
  overflow: auto;
  position: relative;
}
</style>
