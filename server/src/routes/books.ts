import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth';
import { getDb } from '../db/connection';
import { config } from '../config';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
  const db = getDb();
  const {
    library_id,
    format,
    page = '1',
    limit = '20',
    sort = 'title',
    order = 'asc',
  } = req.query;

  let query = db('books');

  if (req.user!.role !== 'admin') {
    const permLibIds = await db('library_permissions')
      .where('user_id', req.user!.userId)
      .pluck('library_id');
    query = query.whereIn('library_id', permLibIds);
  }

  if (library_id) query = query.where('library_id', Number(library_id));
  if (format) query = query.where('format', format as string);

  const countResult = await query.clone().count('* as total').first();
  const total = (countResult as any)?.total || 0;

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const offset = (pageNum - 1) * limitNum;

  const allowedSorts = ['title', 'author', 'created_at', 'file_size'];
  const sortCol = allowedSorts.includes(sort as string) ? (sort as string) : 'title';
  const sortOrder = order === 'desc' ? 'desc' : 'asc';

  const books = await query
    .orderBy(sortCol, sortOrder)
    .limit(limitNum)
    .offset(offset);

  res.json({
    data: books,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

router.get('/:id', async (req: Request, res: Response) => {
  const db = getDb();
  const book = await db('books').where('id', Number(req.params.id)).first();
  if (!book) {
    res.status(404).json({ error: 'Book not found' });
    return;
  }

  if (req.user!.role !== 'admin') {
    const perm = await db('library_permissions')
      .where({ user_id: req.user!.userId, library_id: book.library_id })
      .first();
    if (!perm) {
      res.status(403).json({ error: 'No access' });
      return;
    }
  }

  const progress = await db('reading_progress')
    .where({ user_id: req.user!.userId, book_id: book.id })
    .first();

  res.json({ ...book, progress: progress || null });
});

router.get('/:id/file', async (req: Request, res: Response) => {
  const db = getDb();
  const book = await db('books').where('id', Number(req.params.id)).first();
  if (!book) {
    res.status(404).json({ error: 'Book not found' });
    return;
  }

  if (req.user!.role !== 'admin') {
    const perm = await db('library_permissions')
      .where({ user_id: req.user!.userId, library_id: book.library_id })
      .first();
    if (!perm) {
      res.status(403).json({ error: 'No access' });
      return;
    }
  }

  if (!fs.existsSync(book.file_path)) {
    res.status(404).json({ error: 'File not found on disk' });
    return;
  }

  const mimeTypes: Record<string, string> = {
    epub: 'application/epub+zip',
    pdf: 'application/pdf',
    cbz: 'application/x-cbz',
  };

  res.setHeader('Content-Type', mimeTypes[book.format] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(book.file_path)}"`);
  res.setHeader('Accept-Ranges', 'bytes');

  const stat = fs.statSync(book.file_path);
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Content-Length', end - start + 1);
    fs.createReadStream(book.file_path, { start, end }).pipe(res);
  } else {
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(book.file_path).pipe(res);
  }
});

router.get('/:id/cover', async (req: Request, res: Response) => {
  const db = getDb();
  const book = await db('books').where('id', Number(req.params.id)).first();
  if (!book || !book.cover_path) {
    res.status(404).json({ error: 'Cover not found' });
    return;
  }

  const coverPath = path.resolve(config.coverDir, book.cover_path);
  if (!fs.existsSync(coverPath)) {
    res.status(404).json({ error: 'Cover file not found' });
    return;
  }

  res.sendFile(coverPath);
});

export default router;
