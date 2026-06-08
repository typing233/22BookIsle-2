import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { getDb } from '../db/connection';

const router = Router();
router.use(requireAuth);

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().max(20).optional(),
});

const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().max(20).optional(),
});

const batchTagSchema = z.object({
  book_ids: z.array(z.number().int().positive()).min(1).max(100),
  add_tag_ids: z.array(z.number().int().positive()).optional(),
  remove_tag_ids: z.array(z.number().int().positive()).optional(),
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

async function checkBooksAccess(req: Request, bookIds: number[]): Promise<number[]> {
  if (req.user!.role === 'admin') return [];
  const db = getDb();
  const accessible = await db('books')
    .whereIn('id', bookIds)
    .join('library_permissions', function () {
      this.on('books.library_id', 'library_permissions.library_id')
        .andOn('library_permissions.user_id', db.raw('?', [req.user!.userId]));
    })
    .pluck('books.id');
  const accessibleSet = new Set(accessible);
  return bookIds.filter(id => !accessibleSet.has(id));
}

router.get('/', async (req: Request, res: Response) => {
  const db = getDb();
  const tags = await db('user_tags')
    .where('user_id', req.user!.userId)
    .orderBy('name', 'asc');
  res.json(tags);
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createTagSchema.parse(req.body);
    const db = getDb();
    const now = new Date().toISOString();

    const existing = await db('user_tags')
      .where({ user_id: req.user!.userId, name: data.name })
      .first();
    if (existing) {
      res.status(409).json({ error: 'Tag already exists' });
      return;
    }

    const [id] = await db('user_tags').insert({
      user_id: req.user!.userId,
      name: data.name,
      color: data.color || null,
      created_at: now,
    });

    res.status(201).json({ id, user_id: req.user!.userId, name: data.name, color: data.color || null, created_at: now });
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
    const data = updateTagSchema.parse(req.body);
    const db = getDb();
    const tag = await db('user_tags')
      .where({ id: Number(req.params.id), user_id: req.user!.userId })
      .first();

    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    await db('user_tags')
      .where('id', tag.id)
      .update({ ...data });

    res.json({ ...tag, ...data });
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
  const deleted = await db('user_tags')
    .where({ id: Number(req.params.id), user_id: req.user!.userId })
    .delete();

  if (!deleted) {
    res.status(404).json({ error: 'Tag not found' });
    return;
  }
  res.json({ message: 'Tag deleted' });
});

router.post('/book/:bookId', async (req: Request, res: Response) => {
  try {
    const bookId = Number(req.params.bookId);
    if (!(await checkBookAccess(req, bookId))) {
      res.status(403).json({ error: 'No access to this book' });
      return;
    }
    const { tag_id } = z.object({ tag_id: z.number().int().positive() }).parse(req.body);
    const db = getDb();
    const now = new Date().toISOString();

    const tag = await db('user_tags')
      .where({ id: tag_id, user_id: req.user!.userId })
      .first();
    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    await db('book_tags')
      .insert({
        user_id: req.user!.userId,
        book_id: bookId,
        tag_id,
        created_at: now,
      })
      .onConflict(['user_id', 'book_id', 'tag_id'])
      .ignore();

    res.status(201).json({ message: 'Tag applied' });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/book/:bookId/:tagId', async (req: Request, res: Response) => {
  const bookId = Number(req.params.bookId);
  if (!(await checkBookAccess(req, bookId))) {
    res.status(403).json({ error: 'No access to this book' });
    return;
  }
  const db = getDb();
  await db('book_tags')
    .where({
      user_id: req.user!.userId,
      book_id: bookId,
      tag_id: Number(req.params.tagId),
    })
    .delete();
  res.json({ message: 'Tag removed from book' });
});

router.get('/book/:bookId', async (req: Request, res: Response) => {
  const bookId = Number(req.params.bookId);
  if (!(await checkBookAccess(req, bookId))) {
    res.status(403).json({ error: 'No access to this book' });
    return;
  }
  const db = getDb();
  const tags = await db('book_tags')
    .join('user_tags', 'book_tags.tag_id', 'user_tags.id')
    .where({ 'book_tags.user_id': req.user!.userId, 'book_tags.book_id': bookId })
    .select('user_tags.*');
  res.json(tags);
});

router.put('/batch', async (req: Request, res: Response) => {
  try {
    const { book_ids, add_tag_ids, remove_tag_ids } = batchTagSchema.parse(req.body);
    const db = getDb();
    const now = new Date().toISOString();

    const denied = await checkBooksAccess(req, book_ids);
    if (denied.length > 0) {
      res.status(403).json({ error: 'No access to some books', denied_book_ids: denied });
      return;
    }

    await db.transaction(async (trx) => {
      if (add_tag_ids && add_tag_ids.length > 0) {
        for (const bookId of book_ids) {
          for (const tagId of add_tag_ids) {
            await trx('book_tags')
              .insert({
                user_id: req.user!.userId,
                book_id: bookId,
                tag_id: tagId,
                created_at: now,
              })
              .onConflict(['user_id', 'book_id', 'tag_id'])
              .ignore();
          }
        }
      }

      if (remove_tag_ids && remove_tag_ids.length > 0) {
        await trx('book_tags')
          .where('user_id', req.user!.userId)
          .whereIn('book_id', book_ids)
          .whereIn('tag_id', remove_tag_ids)
          .delete();
      }
    });

    res.json({ message: 'Batch tag operation completed' });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
