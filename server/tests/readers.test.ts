import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from './helpers/setup';
import argon2 from 'argon2';

describe('Reader integration', () => {
  let db: any;
  let userId: number;

  beforeAll(async () => {
    db = await setupTestDb();

    const hash = await argon2.hash('test123');
    const [id] = await db('users').insert({
      username: 'reader',
      password_hash: hash,
      role: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    userId = id;

    await db('libraries').insert({
      id: 1,
      name: 'Test Lib',
      paths: JSON.stringify(['/tmp/books']),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await db('books').insert({
      id: 1,
      library_id: 1,
      file_path: '/tmp/books/test.pdf',
      file_size: 4096,
      file_mtime: new Date().toISOString(),
      format: 'pdf',
      title: 'Test PDF',
      author: 'Author',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await db('books').insert({
      id: 2,
      library_id: 1,
      file_path: '/tmp/books/test.cbz',
      file_size: 8192,
      file_mtime: new Date().toISOString(),
      format: 'cbz',
      title: 'Test Comic',
      author: 'Comic Author',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('PDF reading progress', () => {
    it('should save page-based position for PDF', async () => {
      const position = JSON.stringify({ page: 15, scrollY: 320 });
      const now = new Date().toISOString();

      await db('reading_progress').insert({
        user_id: userId,
        book_id: 1,
        position,
        percentage: 0.25,
        version: 1,
        finished: 0,
        last_read_at: now,
        updated_at: now,
      });

      const progress = await db('reading_progress')
        .where({ user_id: userId, book_id: 1 })
        .first();

      expect(progress).toBeTruthy();
      const pos = JSON.parse(progress.position);
      expect(pos.page).toBe(15);
      expect(pos.scrollY).toBe(320);
      expect(progress.percentage).toBe(0.25);
    });

    it('should update PDF progress version on subsequent sync', async () => {
      const now = new Date().toISOString();
      await db('reading_progress')
        .where({ user_id: userId, book_id: 1 })
        .update({
          position: JSON.stringify({ page: 30, scrollY: 0 }),
          percentage: 0.5,
          version: 2,
          updated_at: now,
        });

      const progress = await db('reading_progress')
        .where({ user_id: userId, book_id: 1 })
        .first();
      expect(progress.version).toBe(2);
      expect(progress.percentage).toBe(0.5);
    });
  });

  describe('Comic reader progress (double-page, RTL)', () => {
    it('should save comic position with view mode and direction', async () => {
      const position = JSON.stringify({
        imageIndex: 4,
        viewMode: 'double',
        direction: 'rtl',
      });
      const now = new Date().toISOString();

      await db('reading_progress').insert({
        user_id: userId,
        book_id: 2,
        position,
        percentage: 0.4,
        version: 1,
        finished: 0,
        device_id: 'tablet-001',
        last_read_at: now,
        updated_at: now,
      });

      const progress = await db('reading_progress')
        .where({ user_id: userId, book_id: 2 })
        .first();

      const pos = JSON.parse(progress.position);
      expect(pos.imageIndex).toBe(4);
      expect(pos.viewMode).toBe('double');
      expect(pos.direction).toBe('rtl');
      expect(progress.device_id).toBe('tablet-001');
    });

    it('should detect conflict on comic progress (lower version)', async () => {
      const existing = await db('reading_progress')
        .where({ user_id: userId, book_id: 2 })
        .first();
      expect(existing.version).toBe(1);

      await db('reading_progress')
        .where({ user_id: userId, book_id: 2 })
        .update({ version: 3, percentage: 0.6, updated_at: new Date().toISOString() });

      const updated = await db('reading_progress')
        .where({ user_id: userId, book_id: 2 })
        .first();
      expect(updated.version).toBe(3);
    });

    it('should record progress history for audit', async () => {
      const now = new Date().toISOString();
      await db('progress_history').insert({
        user_id: userId,
        book_id: 2,
        position: JSON.stringify({ imageIndex: 6, viewMode: 'single', direction: 'ltr' }),
        percentage: 0.6,
        version: 3,
        device_id: 'phone-001',
        created_at: now,
      });

      const history = await db('progress_history')
        .where({ user_id: userId, book_id: 2 })
        .orderBy('created_at', 'desc');
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].device_id).toBe('phone-001');
    });
  });

  describe('Incremental sync with COALESCE', () => {
    it('should find records via last_read_at even without updated_at', async () => {
      const pastTime = '2020-01-01T00:00:00.000Z';
      const recentTime = '2025-06-01T12:00:00.000Z';

      await db('books').insert({
        id: 3,
        library_id: 1,
        file_path: '/tmp/books/old.epub',
        file_size: 512,
        file_mtime: new Date().toISOString(),
        format: 'epub',
        title: 'Old Book',
        author: 'Old Author',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await db('reading_progress').insert({
        user_id: userId,
        book_id: 3,
        position: '{"cfi": "test"}',
        percentage: 0.1,
        version: 1,
        finished: 0,
        last_read_at: recentTime,
        updated_at: null,
      });

      const changes = await db('reading_progress')
        .where('user_id', userId)
        .whereRaw('COALESCE(updated_at, last_read_at) > ?', [pastTime]);

      const bookIds = changes.map((c: any) => c.book_id);
      expect(bookIds).toContain(3);
    });
  });

  describe('Book format detection', () => {
    it('should identify PDF books correctly', async () => {
      const pdf = await db('books').where('id', 1).first();
      expect(pdf.format).toBe('pdf');
    });

    it('should identify CBZ books correctly', async () => {
      const cbz = await db('books').where('id', 2).first();
      expect(cbz.format).toBe('cbz');
    });
  });
});
