<template>
  <div class="reader-page" v-if="book">
    <ReaderToolbar
      :book="book"
      :percentage="percentage"
      :show-toc="showToc"
      @toggle-toc="showToc = !showToc"
      @toggle-bookmarks="showBookmarks = !showBookmarks"
      @add-bookmark="handleAddBookmark"
      @add-note="showNoteModal = true"
      @zoom-in="zoomLevel += 10"
      @zoom-out="zoomLevel -= 10"
      @back="goBack"
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

    <!-- Note/Annotation Modal -->
    <div v-if="showNoteModal" class="modal-overlay" @click.self="showNoteModal = false">
      <div class="modal card">
        <h3>添加批注</h3>
        <div class="form-group">
          <label>标签</label>
          <input v-model="noteForm.label" placeholder="批注标题" />
        </div>
        <div class="form-group">
          <label>备注内容</label>
          <textarea v-model="noteForm.note" rows="4" placeholder="输入你的笔记..."></textarea>
        </div>
        <div class="form-group">
          <label>颜色</label>
          <div class="color-choices">
            <span
              v-for="c in colors"
              :key="c"
              class="color-dot"
              :class="{ active: noteForm.color === c }"
              :style="{ background: c }"
              @click="noteForm.color = c"
            ></span>
          </div>
        </div>
        <div class="form-group">
          <label>类型</label>
          <select v-model="noteForm.type">
            <option value="note">批注</option>
            <option value="highlight">高亮</option>
            <option value="bookmark">书签</option>
          </select>
        </div>
        <div class="form-actions">
          <button class="btn-secondary" @click="showNoteModal = false">取消</button>
          <button class="btn-primary" @click="handleSaveNote">保存</button>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="loading">加载中...</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useReaderStore } from '../stores/reader';
import ReaderToolbar from '../components/ReaderToolbar.vue';
import TOCSidebar from '../components/TOCSidebar.vue';
import BookmarkPanel from '../components/BookmarkPanel.vue';
import EpubReader from '../readers/EpubReader.vue';
import PdfReader from '../readers/PdfReader.vue';
import ComicReader from '../readers/ComicReader.vue';

const route = useRoute();
const router = useRouter();
const readerStore = useReaderStore();
const bookId = Number(route.params.id);

const book = ref<any>(null);
const toc = ref<any[]>([]);
const showToc = ref(false);
const showBookmarks = ref(false);
const showNoteModal = ref(false);
const zoomLevel = ref(100);
const percentage = ref(0);
const savedPosition = ref('');
const currentPositionStr = ref('');

const epubRef = ref<any>(null);
const pdfRef = ref<any>(null);
const comicRef = ref<any>(null);

const bookmarks = computed(() => readerStore.bookmarks);
const fileUrl = computed(() => readerStore.getFileUrl(bookId));

const colors = ['#ffd54f', '#aed581', '#4fc3f7', '#ce93d8', '#ef9a9a'];
const noteForm = ref({ label: '', note: '', color: '#ffd54f', type: 'note' as string });

let saveTimer: any = null;

onMounted(async () => {
  await readerStore.fetchBook(bookId);
  book.value = readerStore.currentBook;
  savedPosition.value = readerStore.position;
  percentage.value = readerStore.percentage;
  await readerStore.fetchBookmarks(bookId);

  saveToLocalHistory();
});

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer);
  saveCurrentPosition();
});

function handlePositionChange(pos: { position: string; percentage: number }) {
  percentage.value = pos.percentage;
  currentPositionStr.value = pos.position;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    readerStore.saveProgress(bookId, pos.position, pos.percentage);
    saveToLocalHistory();
  }, 2000);
}

function saveCurrentPosition() {
  if (percentage.value > 0 && currentPositionStr.value) {
    readerStore.saveProgress(bookId, currentPositionStr.value, percentage.value);
    saveToLocalHistory();
  }
}

function saveToLocalHistory() {
  const key = 'bookisle_reading_history';
  const history: any[] = JSON.parse(localStorage.getItem(key) || '[]');
  const existing = history.findIndex((h: any) => h.bookId === bookId);
  const entry = {
    bookId,
    title: book.value?.title || 'Unknown',
    format: book.value?.format,
    percentage: percentage.value,
    position: currentPositionStr.value || savedPosition.value,
    timestamp: Date.now(),
  };
  if (existing >= 0) {
    history[existing] = entry;
  } else {
    history.unshift(entry);
  }
  localStorage.setItem(key, JSON.stringify(history.slice(0, 50)));
}

async function handleAddBookmark() {
  const position = currentPositionStr.value || savedPosition.value;
  await readerStore.addBookmark({
    book_id: bookId,
    position,
    type: 'bookmark',
    label: `书签 - ${Math.round(percentage.value * 100)}%`,
  });
}

async function handleSaveNote() {
  const position = currentPositionStr.value || savedPosition.value;
  await readerStore.addBookmark({
    book_id: bookId,
    position,
    type: noteForm.value.type,
    label: noteForm.value.label || `批注 - ${Math.round(percentage.value * 100)}%`,
    note: noteForm.value.note,
    color: noteForm.value.color,
  });
  showNoteModal.value = false;
  noteForm.value = { label: '', note: '', color: '#ffd54f', type: 'note' };
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
  try {
    const pos = JSON.parse(bm.position);
    if (book.value?.format === 'epub' && epubRef.value) {
      epubRef.value.goTo(pos.cfi || bm.position);
    } else if (book.value?.format === 'pdf' && pdfRef.value) {
      pdfRef.value.goToPage(pos.page);
    } else if (comicRef.value) {
      comicRef.value.goToPage(pos.imageIndex);
    }
  } catch {
    if (book.value?.format === 'epub' && epubRef.value) {
      epubRef.value.goTo(bm.position);
    }
  }
  showBookmarks.value = false;
}

async function handleDeleteBookmark(id: number) {
  await readerStore.removeBookmark(id);
}

function goBack() {
  saveCurrentPosition();
  router.back();
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
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 500;
}
.modal { width: 100%; max-width: 420px; }
.modal h3 { margin-bottom: 16px; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 4px; }
.form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
.color-choices { display: flex; gap: 8px; }
.color-dot {
  width: 24px; height: 24px; border-radius: 50%; cursor: pointer;
  border: 2px solid transparent; transition: border-color 0.2s;
}
.color-dot.active { border-color: var(--text-dark); }
</style>
