import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getDb } from '../db/connection';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
  const db = getDb();
  const { q, library_id, limit = '20' } = req.query;

  if (!q || (q as string).trim().length === 0) {
    res.status(400).json({ error: 'Search query is required' });
    return;
  }

  const searchTerm = (q as string).trim();
  const limitNum = Math.min(50, Math.max(1, Number(limit)));

  let query = db('books')
    .join('books_fts', 'books.id', 'books_fts.rowid')
    .whereRaw('books_fts MATCH ?', [searchTerm])
    .select('books.*')
    .orderByRaw('rank')
    .limit(limitNum);

  if (library_id) {
    query = query.where('books.library_id', Number(library_id));
  }

  if (req.user!.role !== 'admin') {
    const permLibIds = await db('library_permissions')
      .where('user_id', req.user!.userId)
      .pluck('library_id');
    query = query.whereIn('books.library_id', permLibIds);
  }

  try {
    const results = await query;
    res.json({ data: results, total: results.length });
  } catch (err: any) {
    if (err.message?.includes('fts5')) {
      res.status(400).json({ error: 'Invalid search syntax' });
      return;
    }
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
