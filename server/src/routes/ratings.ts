import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { getDb } from '../db/connection';

const router = Router();
router.use(requireAuth);

const setRatingSchema = z.object({
  rating: z.number().min(1).max(5),
});

const batchRatingSchema = z.object({
  book_ids: z.array(z.number().int().positive()).min(1).max(100),
  rating: z.number().min(1).max(5),
});

async function checkBookAccess(req: Request, bookId: number): Promise<boolean> {
  if (req.user!.role === 'admin') return true;
  const db = getDb();
  const book = await db('books').where('id', bookId).first();
  if (!book) return false;
  const perm = await db('library_permissions')
    .where({ user_id: req.user!.userId, library_id: book.library_id })
    .first();
  return !!perm;
}

router.get('/book/:bookId', async (req: Request, res: Response) => {
  const bookId = Number(req.params.bookId);
  if (!(await checkBookAccess(req, bookId))) {
    res.status(403).json({ error: 'No access to this book' });
    return;
  }
  const db = getDb();
  const rating = await db('user_ratings')
    .where({ user_id: req.user!.userId, book_id: bookId })
    .first();
  res.json(rating || null);
});

router.put('/book/:bookId', async (req: Request, res: Response) => {
  try {
    const bookId = Number(req.params.bookId);
    if (!(await checkBookAccess(req, bookId))) {
      res.status(403).json({ error: 'No access to this book' });
      return;
    }
    const { rating } = setRatingSchema.parse(req.body);
    const db = getDb();
    const now = new Date().toISOString();

    await db('user_ratings')
      .insert({
        user_id: req.user!.userId,
        book_id: bookId,
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
  const bookId = Number(req.params.bookId);
  if (!(await checkBookAccess(req, bookId))) {
    res.status(403).json({ error: 'No access to this book' });
    return;
  }
  const db = getDb();
  await db('user_ratings')
    .where({ user_id: req.user!.userId, book_id: bookId })
    .delete();
  res.json({ message: 'Rating removed' });
});

router.put('/batch', async (req: Request, res: Response) => {
  try {
    const { book_ids, rating } = batchRatingSchema.parse(req.body);
    const db = getDb();
    const now = new Date().toISOString();

    let accessibleBookIds: Set<number>;
    if (req.user!.role === 'admin') {
      accessibleBookIds = new Set(book_ids);
    } else {
      const books = await db('books')
        .whereIn('id', book_ids)
        .join('library_permissions', function () {
          this.on('books.library_id', 'library_permissions.library_id')
            .andOn('library_permissions.user_id', db.raw('?', [req.user!.userId]));
        })
        .pluck('books.id');
      accessibleBookIds = new Set(books);
    }

    const denied = book_ids.filter(id => !accessibleBookIds.has(id));
    if (denied.length > 0) {
      res.status(403).json({ error: 'No access to some books', denied_book_ids: denied });
      return;
    }

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
