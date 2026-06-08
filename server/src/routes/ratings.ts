import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { getDb } from '../db/connection';

const router = Router();
router.use(requireAuth);

const setRatingSchema = z.object({
  rating: z.number().min(0).max(5),
});

const batchRatingSchema = z.object({
  book_ids: z.array(z.number().int().positive()).min(1).max(100),
  rating: z.number().min(0).max(5),
});

router.get('/book/:bookId', async (req: Request, res: Response) => {
  const db = getDb();
  const rating = await db('user_ratings')
    .where({ user_id: req.user!.userId, book_id: Number(req.params.bookId) })
    .first();
  res.json(rating || null);
});

router.put('/book/:bookId', async (req: Request, res: Response) => {
  try {
    const { rating } = setRatingSchema.parse(req.body);
    const db = getDb();
    const now = new Date().toISOString();

    await db('user_ratings')
      .insert({
        user_id: req.user!.userId,
        book_id: Number(req.params.bookId),
        rating,
        created_at: now,
        updated_at: now,
      })
      .onConflict(['user_id', 'book_id'])
      .merge({ rating, updated_at: now });

    res.json({ message: 'Rating saved', rating });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/book/:bookId', async (req: Request, res: Response) => {
  const db = getDb();
  await db('user_ratings')
    .where({ user_id: req.user!.userId, book_id: Number(req.params.bookId) })
    .delete();
  res.json({ message: 'Rating removed' });
});

router.put('/batch', async (req: Request, res: Response) => {
  try {
    const { book_ids, rating } = batchRatingSchema.parse(req.body);
    const db = getDb();
    const now = new Date().toISOString();

    await db.transaction(async (trx) => {
      for (const bookId of book_ids) {
        await trx('user_ratings')
          .insert({
            user_id: req.user!.userId,
            book_id: bookId,
            rating,
            created_at: now,
            updated_at: now,
          })
          .onConflict(['user_id', 'book_id'])
          .merge({ rating, updated_at: now });
      }
    });

    res.json({ message: 'Batch rating applied', count: book_ids.length });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/my', async (req: Request, res: Response) => {
  const db = getDb();
  const ratings = await db('user_ratings')
    .where('user_id', req.user!.userId);
  res.json(ratings);
});

export default router;
