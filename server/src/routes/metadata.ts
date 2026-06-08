import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { getDb } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const router = Router();
router.use(requireAuth);

const updateMetadataSchema = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  description: z.string().optional(),
  publisher: z.string().optional(),
  publish_date: z.string().optional(),
  language: z.string().optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  pattern: z.string().min(1),
  field_mapping: z.record(z.string()),
  example: z.string().optional(),
});

const templateApplySchema = z.object({
  book_ids: z.array(z.number().int().positive()).min(1).max(200),
});

router.put('/books/:bookId', async (req: Request, res: Response) => {
  try {
    const data = updateMetadataSchema.parse(req.body);
    const bookId = Number(req.params.bookId);
    const db = getDb();

    const book = await db('books').where('id', bookId).first();
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const batchId = uuidv4();
    const now = new Date().toISOString();
    const updates: Record<string, any> = {};

    for (const [field, newValue] of Object.entries(data)) {
      if (newValue !== undefined) {
        const oldValue = book[field] || null;
        if (oldValue !== newValue) {
          updates[field] = newValue;
          await db('metadata_history').insert({
            book_id: bookId,
            user_id: req.user!.userId,
            field_name: field,
            old_value: oldValue,
            new_value: newValue,
            batch_id: batchId,
            created_at: now,
          });
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = now;
      await db('books').where('id', bookId).update(updates);
    }

    const updated = await db('books').where('id', bookId).first();
    res.json({ book: updated, batch_id: batchId });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/books/:bookId/history', async (req: Request, res: Response) => {
  const db = getDb();
  const history = await db('metadata_history')
    .where('book_id', Number(req.params.bookId))
    .orderBy('created_at', 'desc')
    .limit(100);
  res.json(history);
});

router.post('/rollback', async (req: Request, res: Response) => {
  try {
    const { batch_id, history_id } = z.object({
      batch_id: z.string().optional(),
      history_id: z.number().int().positive().optional(),
    }).parse(req.body);

    if (!batch_id && !history_id) {
      res.status(400).json({ error: 'Either batch_id or history_id is required' });
      return;
    }

    const db = getDb();
    let entries;

    if (batch_id) {
      entries = await db('metadata_history').where('batch_id', batch_id).orderBy('id', 'asc');
    } else {
      entries = await db('metadata_history').where('id', history_id!);
    }

    if (!entries.length) {
      res.status(404).json({ error: 'History entries not found' });
      return;
    }

    const rollbackBatchId = uuidv4();
    const now = new Date().toISOString();

    await db.transaction(async (trx) => {
      for (const entry of entries) {
        const currentBook = await trx('books').where('id', entry.book_id).first();
        await trx('metadata_history').insert({
          book_id: entry.book_id,
          user_id: req.user!.userId,
          field_name: entry.field_name,
          old_value: currentBook[entry.field_name],
          new_value: entry.old_value,
          batch_id: rollbackBatchId,
          created_at: now,
        });
        await trx('books')
          .where('id', entry.book_id)
          .update({ [entry.field_name]: entry.old_value, updated_at: now });
      }
    });

    res.json({ message: 'Rollback completed', batch_id: rollbackBatchId });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/templates', async (req: Request, res: Response) => {
  const db = getDb();
  const templates = await db('metadata_templates')
    .where('user_id', req.user!.userId)
    .orderBy('created_at', 'desc');

  res.json(templates.map((t: any) => ({
    ...t,
    field_mapping: JSON.parse(t.field_mapping),
  })));
});

router.post('/templates', async (req: Request, res: Response) => {
  try {
    const data = createTemplateSchema.parse(req.body);
    const db = getDb();
    const now = new Date().toISOString();

    new RegExp(data.pattern);

    const [id] = await db('metadata_templates').insert({
      user_id: req.user!.userId,
      name: data.name,
      pattern: data.pattern,
      field_mapping: JSON.stringify(data.field_mapping),
      example: data.example || null,
      created_at: now,
    });

    res.status(201).json({ id, ...data, created_at: now });
  } catch (err: any) {
    if (err instanceof SyntaxError || err.message?.includes('Invalid regular expression')) {
      res.status(400).json({ error: 'Invalid regex pattern' });
      return;
    }
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/templates/:id', async (req: Request, res: Response) => {
  try {
    const data = createTemplateSchema.parse(req.body);
    const db = getDb();

    const template = await db('metadata_templates')
      .where({ id: Number(req.params.id), user_id: req.user!.userId })
      .first();
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    new RegExp(data.pattern);

    await db('metadata_templates')
      .where('id', template.id)
      .update({
        name: data.name,
        pattern: data.pattern,
        field_mapping: JSON.stringify(data.field_mapping),
        example: data.example || null,
      });

    res.json({ id: template.id, ...data });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/templates/:id', async (req: Request, res: Response) => {
  const db = getDb();
  const deleted = await db('metadata_templates')
    .where({ id: Number(req.params.id), user_id: req.user!.userId })
    .delete();
  if (!deleted) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.json({ message: 'Template deleted' });
});

router.post('/templates/:id/preview', async (req: Request, res: Response) => {
  try {
    const { book_ids } = templateApplySchema.parse(req.body);
    const db = getDb();

    const template = await db('metadata_templates')
      .where({ id: Number(req.params.id), user_id: req.user!.userId })
      .first();
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const regex = new RegExp(template.pattern);
    const fieldMapping: Record<string, string> = JSON.parse(template.field_mapping);
    const books = await db('books').whereIn('id', book_ids);

    const results = books.map((book: any) => {
      const filename = path.basename(book.file_path, path.extname(book.file_path));
      const match = regex.exec(filename);
      if (!match) return { book_id: book.id, matched: false, extracted: {} };

      const extracted: Record<string, string> = {};
      for (const [groupIdx, fieldName] of Object.entries(fieldMapping)) {
        const idx = Number(groupIdx);
        if (match[idx]) {
          extracted[fieldName] = match[idx].trim();
        }
      }
      return { book_id: book.id, matched: true, current: { title: book.title, author: book.author }, extracted };
    });

    res.json(results);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/templates/:id/apply', async (req: Request, res: Response) => {
  try {
    const { book_ids } = templateApplySchema.parse(req.body);
    const db = getDb();

    const template = await db('metadata_templates')
      .where({ id: Number(req.params.id), user_id: req.user!.userId })
      .first();
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const regex = new RegExp(template.pattern);
    const fieldMapping: Record<string, string> = JSON.parse(template.field_mapping);
    const books = await db('books').whereIn('id', book_ids);
    const batchId = uuidv4();
    const now = new Date().toISOString();
    let applied = 0;

    await db.transaction(async (trx) => {
      for (const book of books) {
        const filename = path.basename(book.file_path, path.extname(book.file_path));
        const match = regex.exec(filename);
        if (!match) continue;

        const updates: Record<string, any> = {};
        for (const [groupIdx, fieldName] of Object.entries(fieldMapping)) {
          const idx = Number(groupIdx);
          if (match[idx]) {
            const newValue = match[idx].trim();
            const oldValue = book[fieldName] || null;
            if (oldValue !== newValue) {
              updates[fieldName] = newValue;
              await trx('metadata_history').insert({
                book_id: book.id,
                user_id: req.user!.userId,
                field_name: fieldName,
                old_value: oldValue,
                new_value: newValue,
                batch_id: batchId,
                created_at: now,
              });
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          updates.updated_at = now;
          await trx('books').where('id', book.id).update(updates);
          applied++;
        }
      }
    });

    res.json({ message: 'Template applied', batch_id: batchId, applied, total: books.length });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
