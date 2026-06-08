import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api/client';

export interface StatsSummary {
  total_books_read: number;
  books_finished: number;
  total_reading_time_seconds: number;
  total_pages_read: number;
  current_streak: number;
  longest_streak: number;
}

export interface DailyStats {
  date: string;
  duration_seconds: number;
  pages_read: number;
  sessions: number;
}

export const useStatsStore = defineStore('stats', () => {
  const summary = ref<StatsSummary | null>(null);
  const dailyData = ref<DailyStats[]>([]);
  const streak = ref<{ current: number; longest: number }>({ current: 0, longest: 0 });
  const bookStats = ref<any[]>([]);
  const loading = ref(false);

  async function fetchSummary() {
    loading.value = true;
    try {
      const res = await api.get('/stats/summary');
      summary.value = res.data;
    } finally {
      loading.value = false;
    }
  }

  async function fetchDaily(start?: string, end?: string) {
    const params: any = {};
    if (start) params.start = start;
    if (end) params.end = end;
    const res = await api.get('/stats/daily', { params });
    dailyData.value = res.data;
  }

  async function fetchStreak() {
    const res = await api.get('/stats/streak');
    streak.value = res.data;
  }

  async function fetchBookStats() {
    const res = await api.get('/stats/books');
    bookStats.value = res.data;
  }

  return {
    summary, dailyData, streak, bookStats, loading,
    fetchSummary, fetchDaily, fetchStreak, fetchBookStats,
  };
});
