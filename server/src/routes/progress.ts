import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { getDb } from '../db/connection';

const router = Router();
router.use(requireAuth);

const saveProgressSchema = z.object({
  position: z.string().min(1),
  percentage: z.number().min(0).max(1),
});

router.get('/:bookId', async (req: Request, res: Response) => {
  const db = getDb();
  const progress = await db('reading_progress')
    .where({ user_id: req.user!.userId, book_id: Number(req.params.bookId) })
    .first();

  if (!progress) {
    res.json(null);
    return;
  }
  res.json(progress);
});

router.put('/:bookId', async (req: Request, res: Response) => {
  try {
    const data = saveProgressSchema.parse(req.body);
    const db = getDb();
    const bookId = Number(req.params.bookId);
    const now = new Date().toISOString();

    await db('reading_progress')
      .insert({
        user_id: req.user!.userId,
        book_id: bookId,
        position: data.position,
        percentage: data.percentage,
        last_read_at: now,
      })
      .onConflict(['user_id', 'book_id'])
      .merge({
        position: data.position,
        percentage: data.percentage,
        last_read_at: now,
      });

    res.json({ message: 'Progress saved' });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  const db = getDb();
  const history = await db('reading_progress')
    .where('user_id', req.user!.userId)
    .join('books', 'reading_progress.book_id', 'books.id')
    .select('books.*', 'reading_progress.position', 'reading_progress.percentage', 'reading_progress.last_read_at')
    .orderBy('reading_progress.last_read_at', 'desc')
    .limit(50);

  res.json(history);
});

export default router;
