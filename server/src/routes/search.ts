import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { getDb } from '../db/connection';

const router = Router();
router.use(requireAuth);

const searchSchema = z.object({
  q: z.string().optional(),
  library_id: z.coerce.number().optional(),
  format: z.enum(['epub', 'pdf', 'cbz']).optional(),
  author: z.string().optional(),
  rating_min: z.coerce.number().min(0).max(5).optional(),
  rating_max: z.coerce.number().min(0).max(5).optional(),
  tags: z.string().optional(),
  tag_names: z.string().optional(),
  read_status: z.enum(['unread', 'reading', 'finished']).optional(),
  sort: z.enum(['relevance', 'title', 'author', 'rating', 'last_read']).optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const params = searchSchema.parse(req.query);
    const db = getDb();
    const userId = req.user!.userId;
    const pageNum = Math.max(1, params.page || 1);
    const limitNum = Math.min(50, Math.max(1, params.limit || 20));
    const offset = (pageNum - 1) * limitNum;

    let query = db('books').select('books.*');
    let useFts = false;

    if (params.q && params.q.trim().length > 0) {
      useFts = true;
      query = db('books')
        .join('books_fts', 'books.id', 'books_fts.rowid')
        .whereRaw('books_fts MATCH ?', [params.q.trim()])
        .select('books.*');
    }

    if (params.library_id) {
      query = query.where('books.library_id', params.library_id);
    }

    if (params.format) {
      query = query.where('books.format', params.format);
    }

    if (params.author) {
      query = query.where('books.author', 'like', `%${params.author}%`);
    }

    if (req.user!.role !== 'admin') {
      const permLibIds = await db('library_permissions')
        .where('user_id', userId)
        .pluck('library_id');
      query = query.whereIn('books.library_id', permLibIds);
    }

    let hasRatingJoin = false;
    if (params.rating_min !== undefined || params.rating_max !== undefined) {
      hasRatingJoin = true;
      query = query.leftJoin('user_ratings as ur', function () {
        this.on('books.id', '=', 'ur.book_id')
          .andOn('ur.user_id', '=', db.raw('?', [userId]));
      });

      if (params.rating_min !== undefined) {
        query = query.where('ur.rating', '>=', params.rating_min);
      }
      if (params.rating_max !== undefined) {
        query = query.where('ur.rating', '<=', params.rating_max);
      }
    }

    if (params.tags) {
      const tagIds = params.tags.split(',').map(Number).filter(n => !isNaN(n));
      if (tagIds.length > 0) {
        for (let i = 0; i < tagIds.length; i++) {
          const alias = `bt${i}`;
          query = query.join(`book_tags as ${alias}`, function () {
            this.on(`${alias}.book_id`, '=', 'books.id')
              .andOn(`${alias}.user_id`, '=', db.raw('?', [userId]))
              .andOn(`${alias}.tag_id`, '=', db.raw('?', [tagIds[i]]));
          });
        }
      }
    }

    if (params.tag_names) {
      const tagNames = params.tag_names.split(',').map(s => s.trim()).filter(s => s.length > 0);
      if (tagNames.length > 0) {
        const userTags = await db('user_tags')
          .where('user_id', userId)
          .whereIn('name', tagNames)
          .pluck('id');
        if (userTags.length > 0) {
          for (let i = 0; i < userTags.length; i++) {
            const alias = `btn${i}`;
            query = query.join(`book_tags as ${alias}`, function () {
              this.on(`${alias}.book_id`, '=', 'books.id')
                .andOn(`${alias}.user_id`, '=', db.raw('?', [userId]))
                .andOn(`${alias}.tag_id`, '=', db.raw('?', [userTags[i]]));
            });
          }
        } else {
          query = query.whereRaw('1 = 0');
        }
      }
    }

    let hasProgressJoin = false;
    if (params.read_status) {
      hasProgressJoin = true;
      query = query.leftJoin('reading_progress as rp', function () {
        this.on('books.id', '=', 'rp.book_id')
          .andOn('rp.user_id', '=', db.raw('?', [userId]));
      });

      switch (params.read_status) {
        case 'unread':
          query = query.whereNull('rp.id');
          break;
        case 'reading':
          query = query.whereNotNull('rp.id').where('rp.finished', 0).where('rp.percentage', '>', 0);
          break;
        case 'finished':
          query = query.where('rp.finished', 1);
          break;
      }
    }

    const countQuery = query.clone().clearSelect().clearOrder().count('* as total').first();
    const countResult = await countQuery;
    const total = (countResult as any)?.total || 0;

    if (params.sort === 'rating') {
      if (!hasRatingJoin) {
        query = query.leftJoin('user_ratings as ur', function () {
          this.on('books.id', '=', 'ur.book_id')
            .andOn('ur.user_id', '=', db.raw('?', [userId]));
        });
      }
      query = query.orderByRaw('COALESCE(ur.rating, 0) DESC');
    } else if (params.sort === 'last_read') {
      if (!hasProgressJoin) {
        query = query.leftJoin('reading_progress as rp', function () {
          this.on('books.id', '=', 'rp.book_id')
            .andOn('rp.user_id', '=', db.raw('?', [userId]));
        });
      }
      query = query.orderByRaw('COALESCE(rp.last_read_at, "1970-01-01") DESC');
    } else if (params.sort === 'relevance' && useFts) {
      query = query.orderByRaw('rank');
    } else if (params.sort === 'author') {
      query = query.orderBy('books.author', 'asc');
    } else {
      query = query.orderBy('books.title', 'asc');
    }

    const results = await query.limit(limitNum).offset(offset);

    res.json({
      data: results,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid search parameters', details: err.errors });
      return;
    }
    if (err.message?.includes('fts5')) {
      res.status(400).json({ error: 'Invalid search syntax' });
      return;
    }
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
