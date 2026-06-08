import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getDb } from '../db/connection';

const router = Router();
router.use(requireAuth);

router.get('/summary', async (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.userId;

  const totalBooksRead = await db('reading_progress')
    .where('user_id', userId)
    .where('percentage', '>', 0)
    .count('* as count')
    .first();

  const booksFinished = await db('reading_progress')
    .where('user_id', userId)
    .where('finished', 1)
    .count('* as count')
    .first();

  const totalStats = await db('reading_stats')
    .where('user_id', userId)
    .sum('duration_seconds as total_time')
    .sum('pages_read as total_pages')
    .first();

  const streak = await calculateStreak(userId);

  res.json({
    total_books_read: (totalBooksRead as any)?.count || 0,
    books_finished: (booksFinished as any)?.count || 0,
    total_reading_time_seconds: (totalStats as any)?.total_time || 0,
    total_pages_read: (totalStats as any)?.total_pages || 0,
    current_streak: streak.current,
    longest_streak: streak.longest,
  });
});

router.get('/daily', async (req: Request, res: Response) => {
  const db = getDb();
  const { start, end } = req.query;

  const startDate = (start as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = (end as string) || new Date().toISOString().split('T')[0];

  const stats = await db('reading_stats')
    .where('user_id', req.user!.userId)
    .whereBetween('date', [startDate, endDate])
    .select(db.raw('date, SUM(duration_seconds) as duration_seconds, SUM(pages_read) as pages_read, SUM(sessions) as sessions'))
    .groupBy('date')
    .orderBy('date', 'asc');

  res.json(stats);
});

router.get('/streak', async (req: Request, res: Response) => {
  const streak = await calculateStreak(req.user!.userId);
  res.json(streak);
});

router.get('/books', async (req: Request, res: Response) => {
  const db = getDb();
  const stats = await db('reading_stats')
    .where('reading_stats.user_id', req.user!.userId)
    .join('books', 'reading_stats.book_id', 'books.id')
    .select(
      'books.id',
      'books.title',
      'books.author',
      'books.format',
      db.raw('SUM(reading_stats.duration_seconds) as total_time'),
      db.raw('SUM(reading_stats.pages_read) as total_pages'),
      db.raw('SUM(reading_stats.sessions) as total_sessions')
    )
    .groupBy('books.id')
    .orderBy('total_time', 'desc')
    .limit(20);

  res.json(stats);
});

async function calculateStreak(userId: number): Promise<{ current: number; longest: number }> {
  const db = getDb();
  const dates = await db('reading_stats')
    .where('user_id', userId)
    .distinct('date')
    .orderBy('date', 'desc')
    .pluck('date');

  if (dates.length === 0) return { current: 0, longest: 0 };

  let current = 0;
  let longest = 0;
  let streak = 1;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  if (dates[0] === today || dates[0] === yesterday) {
    current = 1;
  }

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays = (prev.getTime() - curr.getTime()) / (24 * 60 * 60 * 1000);

    if (Math.abs(diffDays - 1) < 0.01) {
      streak++;
      if (i <= current || current > 0) {
        current = streak;
      }
    } else {
      longest = Math.max(longest, streak);
      streak = 1;
      if (current > 0 && i > current) break;
    }
  }
  longest = Math.max(longest, streak);
  if (current === 0) current = dates[0] === today ? 1 : 0;

  return { current, longest };
}

export default router;
