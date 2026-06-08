import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from './helpers/setup';
import argon2 from 'argon2';
import path from 'path';

describe('Metadata Management', () => {
  let db: any;
  let userId: number;

  beforeAll(async () => {
    db = await setupTestDb();

    const hash = await argon2.hash('test123');
    const [id] = await db('users').insert({
      username: 'metauser',
      password_hash: hash,
      role: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    userId = id;

    await db('libraries').insert({
      id: 1,
      name: 'Test Lib',
      paths: JSON.stringify(['/books']),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await db('books').insert({
      id: 1,
      library_id: 1,
      file_path: '/books/Author A - Great Book.epub',
      file_size: 1024,
      file_mtime: new Date().toISOString(),
      format: 'epub',
      title: 'Unknown Title',
      author: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await db('books').insert({
      id: 2,
      library_id: 1,
      file_path: '/books/Author B - Another Book.pdf',
      file_size: 2048,
      file_mtime: new Date().toISOString(),
      format: 'pdf',
      title: 'Unknown',
      author: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('should update metadata and record history', async () => {
    const now = new Date().toISOString();
    const book = await db('books').where('id', 1).first();

    await db('metadata_history').insert({
      book_id: 1,
      user_id: userId,
      field_name: 'title',
      old_value: book.title,
      new_value: 'Great Book',
      batch_id: 'batch-001',
      created_at: now,
    });

    await db('books').where('id', 1).update({ title: 'Great Book', updated_at: now });

    const updated = await db('books').where('id', 1).first();
    expect(updated.title).toBe('Great Book');

    const history = await db('metadata_history').where('book_id', 1);
    expect(history.length).toBe(1);
    expect(history[0].old_value).toBe('Unknown Title');
    expect(history[0].new_value).toBe('Great Book');
  });

  it('should rollback metadata changes', async () => {
    const now = new Date().toISOString();
    const entry = await db('metadata_history').where({ book_id: 1, batch_id: 'batch-001' }).first();

    await db('books').where('id', 1).update({ title: entry.old_value, updated_at: now });

    await db('metadata_history').insert({
      book_id: 1,
      user_id: userId,
      field_name: 'title',
      old_value: 'Great Book',
      new_value: entry.old_value,
      batch_id: 'rollback-001',
      created_at: now,
    });

    const rolledBack = await db('books').where('id', 1).first();
    expect(rolledBack.title).toBe('Unknown Title');
  });

  it('should create and use metadata templates', async () => {
    const now = new Date().toISOString();
    const pattern = '^(.+?)\\s*-\\s*(.+)$';
    const fieldMapping = { '1': 'author', '2': 'title' };

    const [templateId] = await db('metadata_templates').insert({
      user_id: userId,
      name: 'Author - Title',
      pattern,
      field_mapping: JSON.stringify(fieldMapping),
      example: 'Author A - Great Book',
      created_at: now,
    });

    const template = await db('metadata_templates').where('id', templateId).first();
    expect(template.name).toBe('Author - Title');

    const regex = new RegExp(template.pattern);
    const books = await db('books').select('*');

    const results = books.map((book: any) => {
      const filename = path.basename(book.file_path, path.extname(book.file_path));
      const match = regex.exec(filename);
      if (!match) return { book_id: book.id, matched: false };

      const mapping = JSON.parse(template.field_mapping);
      const extracted: Record<string, string> = {};
      for (const [group, field] of Object.entries(mapping)) {
        const idx = Number(group);
        if (match[idx]) extracted[field as string] = match[idx].trim();
      }
      return { book_id: book.id, matched: true, extracted };
    });

    expect(results[0].matched).toBe(true);
    expect(results[0].extracted.author).toBe('Author A');
    expect(results[0].extracted.title).toBe('Great Book');

    expect(results[1].matched).toBe(true);
    expect(results[1].extracted.author).toBe('Author B');
    expect(results[1].extracted.title).toBe('Another Book');
  });

  it('should batch apply template to books', async () => {
    const template = await db('metadata_templates').where('user_id', userId).first();
    const regex = new RegExp(template.pattern);
    const fieldMapping = JSON.parse(template.field_mapping);
    const books = await db('books').select('*');
    const now = new Date().toISOString();
    const batchId = 'apply-batch-001';

    for (const book of books) {
      const filename = path.basename(book.file_path, path.extname(book.file_path));
      const match = regex.exec(filename);
      if (!match) continue;

      const updates: Record<string, any> = {};
      for (const [group, field] of Object.entries(fieldMapping)) {
        const idx = Number(group);
        if (match[idx]) {
          const newVal = match[idx].trim();
          if (book[field as string] !== newVal) {
            updates[field as string] = newVal;
            await db('metadata_history').insert({
              book_id: book.id,
              user_id: userId,
              field_name: field as string,
              old_value: book[field as string],
              new_value: newVal,
              batch_id: batchId,
              created_at: now,
            });
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await db('books').where('id', book.id).update({ ...updates, updated_at: now });
      }
    }

    const book1 = await db('books').where('id', 1).first();
    const book2 = await db('books').where('id', 2).first();

    expect(book1.author).toBe('Author A');
    expect(book2.author).toBe('Author B');
    expect(book2.title).toBe('Another Book');

    const batchHistory = await db('metadata_history').where('batch_id', batchId);
    expect(batchHistory.length).toBeGreaterThan(0);
  });
});
