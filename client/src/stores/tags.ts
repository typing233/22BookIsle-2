import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api/client';

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string | null;
  created_at: string;
}

export const useTagsStore = defineStore('tags', () => {
  const tags = ref<Tag[]>([]);
  const bookRatings = ref<Map<number, number>>(new Map());
  const bookTags = ref<Map<number, Tag[]>>(new Map());

  async function fetchTags() {
    const res = await api.get('/tags');
    tags.value = res.data;
  }

  async function createTag(name: string, color?: string) {
    const res = await api.post('/tags', { name, color });
    tags.value.push(res.data);
    return res.data;
  }

  async function updateTag(id: number, data: { name?: string; color?: string }) {
    const res = await api.put(`/tags/${id}`, data);
    const idx = tags.value.findIndex((t) => t.id === id);
    if (idx >= 0) tags.value[idx] = { ...tags.value[idx], ...res.data };
    return res.data;
  }

  async function deleteTag(id: number) {
    await api.delete(`/tags/${id}`);
    tags.value = tags.value.filter((t) => t.id !== id);
  }

  async function fetchBookTags(bookId: number) {
    const res = await api.get(`/tags/book/${bookId}`);
    bookTags.value.set(bookId, res.data);
    return res.data;
  }

  async function addTagToBook(bookId: number, tagId: number) {
    await api.post(`/tags/book/${bookId}`, { tag_id: tagId });
    const existing = bookTags.value.get(bookId) || [];
    const tag = tags.value.find((t) => t.id === tagId);
    if (tag && !existing.find((t) => t.id === tagId)) {
      bookTags.value.set(bookId, [...existing, tag]);
    }
  }

  async function removeTagFromBook(bookId: number, tagId: number) {
    await api.delete(`/tags/book/${bookId}/${tagId}`);
    const existing = bookTags.value.get(bookId) || [];
    bookTags.value.set(bookId, existing.filter((t) => t.id !== tagId));
  }

  async function batchTag(bookIds: number[], addTagIds?: number[], removeTagIds?: number[]) {
    await api.put('/tags/batch', { book_ids: bookIds, add_tag_ids: addTagIds, remove_tag_ids: removeTagIds });
  }

  async function fetchRating(bookId: number) {
    const res = await api.get(`/ratings/book/${bookId}`);
    if (res.data) {
      bookRatings.value.set(bookId, res.data.rating);
    }
    return res.data?.rating || 0;
  }

  async function setRating(bookId: number, rating: number) {
    await api.put(`/ratings/book/${bookId}`, { rating });
    bookRatings.value.set(bookId, rating);
  }

  async function removeRating(bookId: number) {
    await api.delete(`/ratings/book/${bookId}`);
    bookRatings.value.delete(bookId);
  }

  async function batchRate(bookIds: number[], rating: number) {
    await api.put('/ratings/batch', { book_ids: bookIds, rating });
    for (const id of bookIds) {
      bookRatings.value.set(id, rating);
    }
  }

  return {
    tags, bookRatings, bookTags,
    fetchTags, createTag, updateTag, deleteTag,
    fetchBookTags, addTagToBook, removeTagFromBook, batchTag,
    fetchRating, setRating, removeRating, batchRate,
  };
});
