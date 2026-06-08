import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api/client';
import { syncQueue } from '../services/syncQueue';

export const useReaderStore = defineStore('reader', () => {
  const currentBook = ref<any>(null);
  const position = ref<string>('');
  const percentage = ref(0);
  const bookmarks = ref<any[]>([]);
  const loading = ref(false);
  const pendingSyncCount = ref(0);

  async function fetchBook(id: number) {
    loading.value = true;
    try {
      const res = await api.get(`/books/${id}`);
      currentBook.value = res.data;
      if (res.data.progress) {
        position.value = res.data.progress.position;
        percentage.value = res.data.progress.percentage;
        if (res.data.progress.version) {
          syncQueue.setVersion(id, res.data.progress.version);
        }
      }
    } finally {
      loading.value = false;
    }
  }

  async function saveProgress(bookId: number, pos: string, pct: number, finished = false) {
    position.value = pos;
    percentage.value = pct;

    await syncQueue.enqueue(bookId, pos, pct, finished);
    pendingSyncCount.value = await syncQueue.getPendingCount();

    try {
      const version = syncQueue.getNextVersion(bookId) - 1;
      const res = await api.put(`/progress/${bookId}`, {
        position: pos,
        percentage: pct,
        version,
        device_id: syncQueue.getDeviceId(),
        finished,
      });

      if (res.data.accepted) {
        const items = await syncQueue.getAllItems();
        const matching = items.filter((i) => i.bookId === bookId && i.version <= version);
        for (const m of matching) {
          await syncQueue.removeItem(m.id);
        }
        pendingSyncCount.value = await syncQueue.getPendingCount();
      } else if (res.data.conflict) {
        position.value = res.data.server_position;
        percentage.value = res.data.server_percentage;
        syncQueue.setVersion(bookId, res.data.server_version);
      }
    } catch {
      // Stays in queue for later sync
    }
  }

  async function syncPendingProgress() {
    const count = await syncQueue.getPendingCount();
    if (count === 0) return;

    const result = await syncQueue.flush(async (items) => {
      const res = await api.post('/progress/batch', { items });
      return res.data;
    });

    pendingSyncCount.value = await syncQueue.getPendingCount();
    return result;
  }

  async function fetchBookmarks(bookId: number) {
    const res = await api.get('/bookmarks', { params: { book_id: bookId } });
    bookmarks.value = res.data;
  }

  async function addBookmark(data: any) {
    const res = await api.post('/bookmarks', data);
    bookmarks.value.unshift(res.data);
    return res.data;
  }

  async function removeBookmark(id: number) {
    await api.delete(`/bookmarks/${id}`);
    bookmarks.value = bookmarks.value.filter((b) => b.id !== id);
  }

  function getFileUrl(bookId: number): string {
    const token = localStorage.getItem('accessToken');
    return `/api/books/${bookId}/file?token=${token}`;
  }

  return {
    currentBook, position, percentage, bookmarks, loading, pendingSyncCount,
    fetchBook, saveProgress, syncPendingProgress, fetchBookmarks, addBookmark, removeBookmark, getFileUrl,
  };
});
