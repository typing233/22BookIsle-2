import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, getTestDb } from './helpers/setup';

describe('Books API', () => {
  let db: any;

  beforeAll(async () => {
    db = await setupTestDb();
    await db('users').insert({
      username: 'admin',
      password_hash: 'hash',
      role: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await db('libraries').insert({
      name: 'Test Library',
      paths: JSON.stringify(['/tmp/books']),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('should insert and query books', async () => {
    await db('books').insert({
      library_id: 1,
      file_path: '/tmp/books/test.epub',
      file_size: 1024,
      file_mtime: new Date().toISOString(),
      format: 'epub',
      title: 'Test Book',
      author: 'Test Author',
      description: 'A test book',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const books = await db('books').where('library_id', 1);
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe('Test Book');
    expect(books[0].format).toBe('epub');
  });

  it('should support FTS search', async () => {
    const results = await db.raw(
      "SELECT * FROM books_fts WHERE books_fts MATCH ?",
      ['Test']
    );
    expect(results.length).toBeGreaterThan(0);
  });

  it('should track reading progress', async () => {
    await db('reading_progress').insert({
      user_id: 1,
      book_id: 1,
      position: JSON.stringify({ cfi: 'test-cfi', percentage: 0.5 }),
      percentage: 0.5,
      last_read_at: new Date().toISOString(),
    });

    const progress = await db('reading_progress').where({ user_id: 1, book_id: 1 }).first();
    expect(progress).toBeTruthy();
    expect(progress.percentage).toBe(0.5);
  });

  it('should manage bookmarks', async () => {
    await db('bookmarks').insert({
      user_id: 1,
      book_id: 1,
      position: JSON.stringify({ cfi: 'bookmark-cfi' }),
      label: 'My bookmark',
      type: 'bookmark',
      created_at: new Date().toISOString(),
    });

    const bookmarks = await db('bookmarks').where({ user_id: 1, book_id: 1 });
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].label).toBe('My bookmark');
  });

  it('should enforce library permissions', async () => {
    await db('users').insert({
      username: 'reader',
      password_hash: 'hash',
      role: 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await db('library_permissions').insert({
      user_id: 2,
      library_id: 1,
      permission: 'read',
      granted_by: 1,
      created_at: new Date().toISOString(),
    });

    const perm = await db('library_permissions').where({ user_id: 2, library_id: 1 }).first();
    expect(perm.permission).toBe('read');
  });

  it('should detect duplicates via hash', async () => {
    await db('books').insert({
      library_id: 1,
      file_path: '/tmp/books/copy.epub',
      file_hash: 'abc123hash',
      file_size: 1024,
      file_mtime: new Date().toISOString(),
      format: 'epub',
      title: 'Duplicate Book',
      is_duplicate: 1,
      duplicate_of: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const dupes = await db('books').where('is_duplicate', 1);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].duplicate_of).toBe(1);
  });
});
