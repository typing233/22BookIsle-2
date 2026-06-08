import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api/client';

export const useLibraryStore = defineStore('library', () => {
  const libraries = ref<any[]>([]);
  const currentLibrary = ref<any>(null);
  const books = ref<any[]>([]);
  const totalBooks = ref(0);
  const currentPage = ref(1);
  const loading = ref(false);

  async function fetchLibraries() {
    const res = await api.get('/libraries');
    libraries.value = res.data;
  }

  async function fetchLibrary(id: number) {
    const res = await api.get(`/libraries/${id}`);
    currentLibrary.value = res.data;
  }

  async function fetchBooks(params: Record<string, any> = {}) {
    loading.value = true;
    try {
      const res = await api.get('/books', { params });
      books.value = res.data.data;
      totalBooks.value = res.data.total;
      currentPage.value = res.data.page;
    } finally {
      loading.value = false;
    }
  }

  async function createLibrary(data: { name: string; paths: string[]; scan_schedule?: string }) {
    const res = await api.post('/libraries', data);
    libraries.value.push(res.data);
    return res.data;
  }

  async function deleteLibrary(id: number) {
    await api.delete(`/libraries/${id}`);
    libraries.value = libraries.value.filter((l) => l.id !== id);
  }

  async function startScan(libraryId: number) {
    const res = await api.post('/scan/start', { library_id: libraryId });
    return res.data;
  }

  return {
    libraries, currentLibrary, books, totalBooks, currentPage, loading,
    fetchLibraries, fetchLibrary, fetchBooks, createLibrary, deleteLibrary, startScan,
  };
});
