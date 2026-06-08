import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { getDb } from '../db/connection';

const router = Router();
router.use(requireAuth);

const createBookmarkSchema = z.object({
  book_id: z.number().int().positive(),
  position: z.string().min(1),
  label: z.string().optional(),
  note: z.string().optional(),
  color: z.string().optional(),
  type: z.enum(['bookmark', 'highlight', 'note']),
});

const updateBookmarkSchema = z.object({
  label: z.string().optional(),
  note: z.string().optional(),
  color: z.string().optional(),
});

router.get('/', async (req: Request, res: Response) => {
  const db = getDb();
  const { book_id } = req.query;

  let query = db('bookmarks').where('user_id', req.user!.userId);
  if (book_id) query = query.where('book_id', Number(book_id));

  const bookmarks = await query.orderBy('created_at', 'desc');
  res.json(bookmarks);
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createBookmarkSchema.parse(req.body);
    const db = getDb();

    const [id] = await db('bookmarks').insert({
      user_id: req.user!.userId,
      book_id: data.book_id,
      position: data.position,
      label: data.label || null,
      note: data.note || null,
      color: data.color || null,
      type: data.type,
      created_at: new Date().toISOString(),
    });

    res.status(201).json({ id, ...data });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const data = updateBookmarkSchema.parse(req.body);
    const db = getDb();
    const id = Number(req.params.id);

    const bookmark = await db('bookmarks').where({ id, user_id: req.user!.userId }).first();
    if (!bookmark) {
      res.status(404).json({ error: 'Bookmark not found' });
      return;
    }

    const updates: any = {};
    if (data.label !== undefined) updates.label = data.label;
    if (data.note !== undefined) updates.note = data.note;
    if (data.color !== undefined) updates.color = data.color;

    await db('bookmarks').where('id', id).update(updates);
    res.json({ id, ...updates });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);

  const bookmark = await db('bookmarks').where({ id, user_id: req.user!.userId }).first();
  if (!bookmark) {
    res.status(404).json({ error: 'Bookmark not found' });
    return;
  }

  await db('bookmarks').where('id', id).delete();
  res.json({ message: 'Bookmark deleted' });
});

export default router;
