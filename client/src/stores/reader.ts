import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api/client';

export const useReaderStore = defineStore('reader', () => {
  const currentBook = ref<any>(null);
  const position = ref<string>('');
  const percentage = ref(0);
  const bookmarks = ref<any[]>([]);
  const loading = ref(false);

  async function fetchBook(id: number) {
    loading.value = true;
    try {
      const res = await api.get(`/books/${id}`);
      currentBook.value = res.data;
      if (res.data.progress) {
        position.value = res.data.progress.position;
        percentage.value = res.data.progress.percentage;
      }
    } finally {
      loading.value = false;
    }
  }

  async function saveProgress(bookId: number, pos: string, pct: number) {
    position.value = pos;
    percentage.value = pct;
    await api.put(`/progress/${bookId}`, { position: pos, percentage: pct });
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
    currentBook, position, percentage, bookmarks, loading,
    fetchBook, saveProgress, fetchBookmarks, addBookmark, removeBookmark, getFileUrl,
  };
});
