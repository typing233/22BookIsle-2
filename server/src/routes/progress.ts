import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { idempotencyCheck } from '../middleware/idempotency';
import { getDb } from '../db/connection';

const router = Router();
router.use(requireAuth);

const saveProgressSchema = z.object({
  position: z.string().min(1),
  percentage: z.number().min(0).max(1),
  version: z.number().int().min(1).optional(),
  device_id: z.string().max(64).optional(),
  finished: z.boolean().optional(),
  last_read_at: z.string().optional(),
});

const batchSyncSchema = z.object({
  items: z.array(z.object({
    book_id: z.number().int().positive(),
    position: z.string().min(1),
    percentage: z.number().min(0).max(1),
    version: z.number().int().min(1),
    device_id: z.string().max(64).optional(),
    finished: z.boolean().optional(),
    last_read_at: z.string().optional(),
    idempotency_key: z.string().max(128),
  })).min(1).max(50),
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

router.put('/:bookId', idempotencyCheck(), async (req: Request, res: Response) => {
  try {
    const bookId = Number(req.params.bookId);
    if (!(await checkBookAccess(req, res, bookId))) return;

    const data = saveProgressSchema.parse(req.body);
    const db = getDb();
    const now = data.last_read_at || new Date().toISOString();

    const existing = await db('reading_progress')
      .where({ user_id: req.user!.userId, book_id: bookId })
      .first();

    const clientVersion = data.version || (existing ? existing.version + 1 : 1);

    if (existing && clientVersion < existing.version) {
      const clientPercentage = data.percentage;
      const serverPercentage = existing.percentage;
      const clientTime = new Date(now).getTime();
      const serverTime = new Date(existing.last_read_at).getTime();

      let winner: 'client' | 'server';
      if (clientPercentage > serverPercentage) {
        winner = 'client';
      } else if (serverPercentage > clientPercentage) {
        winner = 'server';
      } else {
        winner = clientTime >= serverTime ? 'client' : 'server';
      }

      if (winner === 'server') {
        res.json({
          accepted: false,
          conflict: true,
          resolved: 'server_wins',
          server_version: existing.version,
          server_position: existing.position,
          server_percentage: existing.percentage,
        });
        return;
      }
    }

    await db('reading_progress')
      .insert({
        user_id: req.user!.userId,
        book_id: bookId,
        position: data.position,
        percentage: data.percentage,
        version: clientVersion,
        finished: data.finished ? 1 : 0,
        device_id: data.device_id || null,
        last_read_at: now,
        updated_at: now,
      })
      .onConflict(['user_id', 'book_id'])
      .merge({
        position: data.position,
        percentage: data.percentage,
        version: clientVersion,
        finished: data.finished ? 1 : 0,
        device_id: data.device_id || null,
        last_read_at: now,
        updated_at: now,
      });

    await db('progress_history').insert({
      user_id: req.user!.userId,
      book_id: bookId,
      position: data.position,
      percentage: data.percentage,
      version: clientVersion,
      device_id: data.device_id || null,
      created_at: now,
    });

    if (data.percentage > 0 && existing) {
      const lastTime = new Date(existing.last_read_at).getTime();
      const currentTime = new Date(now).getTime();
      const durationSec = Math.floor((currentTime - lastTime) / 1000);

      if (durationSec > 0 && durationSec < 7200) {
        const today = new Date().toISOString().split('T')[0];
        await db('reading_stats')
          .insert({
            user_id: req.user!.userId,
            book_id: bookId,
            date: today,
            duration_seconds: durationSec,
            pages_read: 0,
            sessions: 1,
          })
          .onConflict(['user_id', 'book_id', 'date'])
          .merge({
            duration_seconds: db.raw('duration_seconds + ?', [durationSec]),
            sessions: db.raw('sessions + 1'),
          });
      }
    }

    res.json({ accepted: true, version: clientVersion });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/batch', idempotencyCheck(), async (req: Request, res: Response) => {
  try {
    const { items } = batchSyncSchema.parse(req.body);
    const db = getDb();
    const results: any[] = [];

    const bookIds = [...new Set(items.map(i => i.book_id))];
    let accessibleBookIds: Set<number>;

    if (req.user!.role === 'admin') {
      accessibleBookIds = new Set(bookIds);
    } else {
      const books = await db('books')
        .whereIn('id', bookIds)
        .join('library_permissions', function () {
          this.on('books.library_id', 'library_permissions.library_id')
            .andOn('library_permissions.user_id', db.raw('?', [req.user!.userId]));
        })
        .pluck('books.id');
      accessibleBookIds = new Set(books);
    }

    await db.transaction(async (trx) => {
      for (const item of items) {
        if (!accessibleBookIds.has(item.book_id)) {
          results.push({ book_id: item.book_id, accepted: false, error: 'No access to this book' });
          continue;
        }

        const existing = await trx('reading_progress')
          .where({ user_id: req.user!.userId, book_id: item.book_id })
          .first();

        if (existing && item.version < existing.version) {
          const clientTime = new Date(item.last_read_at || new Date().toISOString()).getTime();
          const serverTime = new Date(existing.last_read_at).getTime();

          let winner: 'client' | 'server';
          if (item.percentage > existing.percentage) {
            winner = 'client';
          } else if (existing.percentage > item.percentage) {
            winner = 'server';
          } else {
            winner = clientTime >= serverTime ? 'client' : 'server';
          }

          if (winner === 'server') {
            results.push({
              book_id: item.book_id,
              accepted: false,
              conflict: true,
              resolved: 'server_wins',
              server_version: existing.version,
              server_position: existing.position,
              server_percentage: existing.percentage,
            });
            continue;
          }
        }

        const now = item.last_read_at || new Date().toISOString();

        await trx('reading_progress')
          .insert({
            user_id: req.user!.userId,
            book_id: item.book_id,
            position: item.position,
            percentage: item.percentage,
            version: item.version,
            finished: item.finished ? 1 : 0,
            device_id: item.device_id || null,
            last_read_at: now,
            updated_at: now,
          })
          .onConflict(['user_id', 'book_id'])
          .merge({
            position: item.position,
            percentage: item.percentage,
            version: item.version,
            finished: item.finished ? 1 : 0,
            device_id: item.device_id || null,
            last_read_at: now,
            updated_at: now,
          });

        await trx('progress_history').insert({
          user_id: req.user!.userId,
          book_id: item.book_id,
          position: item.position,
          percentage: item.percentage,
          version: item.version,
          device_id: item.device_id || null,
          created_at: now,
        });

        results.push({ book_id: item.book_id, accepted: true, version: item.version });
      }
    });

    res.json({ results });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/since/:timestamp', async (req: Request, res: Response) => {
  const db = getDb();
  const since = req.params.timestamp;

  const changes = await db('reading_progress')
    .where('user_id', req.user!.userId)
    .whereRaw('COALESCE(updated_at, last_read_at) > ?', [since])
    .select('*');

  res.json({ changes, server_time: new Date().toISOString() });
});

router.get('/', async (req: Request, res: Response) => {
  const db = getDb();

  let query = db('reading_progress')
    .where('reading_progress.user_id', req.user!.userId)
    .join('books', 'reading_progress.book_id', 'books.id')
    .select('books.*', 'reading_progress.position', 'reading_progress.percentage', 'reading_progress.last_read_at', 'reading_progress.version', 'reading_progress.finished')
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
