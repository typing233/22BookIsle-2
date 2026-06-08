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

async function checkBookAccess(req: Request, res: Response, bookId: number): Promise<boolean> {
  if (req.user!.role === 'admin') return true;
  const db = getDb();
  const book = await db('books').where('id', bookId).first();
  if (!book) {
    res.status(404).json({ error: 'Book not found' });
    return false;
  }
  const perm = await db('library_permissions')
    .where({ user_id: req.user!.userId, library_id: book.library_id })
    .first();
  if (!perm) {
    res.status(403).json({ error: 'No access to this book' });
    return false;
  }
  return true;
}

router.get('/:bookId', async (req: Request, res: Response) => {
  const bookId = Number(req.params.bookId);
  if (!(await checkBookAccess(req, res, bookId))) return;

  const db = getDb();
  const progress = await db('reading_progress')
    .where({ user_id: req.user!.userId, book_id: bookId })
    .first();

  res.json(progress || null);
});

router.put('/:bookId', async (req: Request, res: Response) => {
  try {
    const bookId = Number(req.params.bookId);
    if (!(await checkBookAccess(req, res, bookId))) return;

    const data = saveProgressSchema.parse(req.body);
    const db = getDb();
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

  let query = db('reading_progress')
    .where('reading_progress.user_id', req.user!.userId)
    .join('books', 'reading_progress.book_id', 'books.id')
    .select('books.*', 'reading_progress.position', 'reading_progress.percentage', 'reading_progress.last_read_at')
    .orderBy('reading_progress.last_read_at', 'desc')
    .limit(50);

  if (req.user!.role !== 'admin') {
    const permLibIds = await db('library_permissions')
      .where('user_id', req.user!.userId)
      .pluck('library_id');
    query = query.whereIn('books.library_id', permLibIds);
  }

  const history = await query;
  res.json(history);
});

export default router;
