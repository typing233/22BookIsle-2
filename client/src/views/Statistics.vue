<template>
  <div class="stats-page">
    <h1 class="page-title">阅读统计</h1>

    <div v-if="statsStore.loading" class="loading">加载中...</div>
    <template v-else-if="statsStore.summary">
      <div class="stats-grid">
        <div class="stat-card card">
          <div class="stat-value">{{ statsStore.summary.total_books_read }}</div>
          <div class="stat-label">在读书籍</div>
        </div>
        <div class="stat-card card">
          <div class="stat-value">{{ statsStore.summary.books_finished }}</div>
          <div class="stat-label">已读完</div>
        </div>
        <div class="stat-card card">
          <div class="stat-value">{{ formatDuration(statsStore.summary.total_reading_time_seconds) }}</div>
          <div class="stat-label">总阅读时间</div>
        </div>
        <div class="stat-card card">
          <div class="stat-value">{{ statsStore.summary.total_pages_read }}</div>
          <div class="stat-label">总页数</div>
        </div>
        <div class="stat-card card highlight">
          <div class="stat-value">{{ statsStore.streak.current }} 天</div>
          <div class="stat-label">当前连续阅读</div>
        </div>
        <div class="stat-card card">
          <div class="stat-value">{{ statsStore.streak.longest }} 天</div>
          <div class="stat-label">最长连续阅读</div>
        </div>
      </div>

      <section class="section">
        <h2 class="section-title">每日阅读时间 (近30天)</h2>
        <div class="chart-container">
          <div class="bar-chart">
            <div
              v-for="day in chartData"
              :key="day.date"
              class="bar-item"
              :title="`${day.date}: ${Math.round(day.duration_seconds / 60)} 分钟`"
            >
              <div class="bar" :style="{ height: day.height + '%' }"></div>
              <span class="bar-label">{{ day.label }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">阅读最多的书籍</h2>
        <div v-if="statsStore.bookStats.length" class="book-stats-list">
          <div v-for="book in statsStore.bookStats" :key="book.id" class="book-stat-item card">
            <div class="book-stat-info">
              <h4>{{ book.title || '未知' }}</h4>
              <span class="book-stat-author">{{ book.author || '-' }}</span>
            </div>
            <div class="book-stat-numbers">
              <span>{{ formatDuration(book.total_time) }}</span>
              <span class="sep">·</span>
              <span>{{ book.total_sessions }} 次</span>
            </div>
          </div>
        </div>
        <p v-else class="empty">暂无阅读记录</p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useStatsStore } from '../stores/stats';

const statsStore = useStatsStore();

onMounted(async () => {
  await Promise.all([
    statsStore.fetchSummary(),
    statsStore.fetchDaily(),
    statsStore.fetchStreak(),
    statsStore.fetchBookStats(),
  ]);
});

const chartData = computed(() => {
  const data = statsStore.dailyData;
  if (!data.length) return [];

  const maxDuration = Math.max(...data.map((d) => d.duration_seconds), 1);

  const last30: any[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const entry = data.find((d) => d.date === date);
    last30.push({
      date,
      duration_seconds: entry?.duration_seconds || 0,
      height: entry ? (entry.duration_seconds / maxDuration) * 100 : 0,
      label: date.slice(8),
    });
  }
  return last30;
});

function formatDuration(seconds: number): string {
  if (!seconds) return '0分';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}时${mins}分`;
  return `${mins}分`;
}
</script>

<style scoped>
.stats-page { max-width: 900px; margin: 0 auto; }
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}
.stat-card { text-align: center; padding: 20px 16px; }
.stat-value { font-size: 28px; font-weight: 700; color: var(--primary); margin-bottom: 4px; }
.stat-label { font-size: 13px; color: var(--text-light); }
.stat-card.highlight { background: var(--primary); color: white; }
.stat-card.highlight .stat-value { color: white; }
.stat-card.highlight .stat-label { color: rgba(255,255,255,0.8); }
.section { margin-bottom: 32px; }
.section-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
.chart-container { background: var(--bg-card); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow); }
.bar-chart { display: flex; align-items: flex-end; gap: 4px; height: 200px; }
.bar-item { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
.bar {
  width: 100%; min-width: 8px; background: var(--primary); border-radius: 3px 3px 0 0;
  transition: height 0.3s;
}
.bar-label { font-size: 10px; color: var(--text-light); margin-top: 4px; }
.book-stats-list { display: flex; flex-direction: column; gap: 8px; }
.book-stat-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; }
.book-stat-info h4 { font-size: 14px; margin-bottom: 2px; }
.book-stat-author { font-size: 12px; color: var(--text-light); }
.book-stat-numbers { display: flex; gap: 4px; font-size: 13px; color: var(--text-light); }
.sep { opacity: 0.5; }
</style>
