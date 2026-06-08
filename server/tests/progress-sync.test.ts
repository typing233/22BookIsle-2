import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from './helpers/setup';
import argon2 from 'argon2';

describe('Progress Sync', () => {
  let db: any;
  let userId: number;

  beforeAll(async () => {
    db = await setupTestDb();

    const hash = await argon2.hash('test123');
    const [id] = await db('users').insert({
      username: 'syncuser',
      password_hash: hash,
      role: 'user',
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
      file_path: '/tmp/books/test.epub',
      file_size: 1024,
      file_mtime: new Date().toISOString(),
      format: 'epub',
      title: 'Test Book',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await db('library_permissions').insert({
      user_id: userId,
      library_id: 1,
      permission: 'read',
      granted_by: null,
      created_at: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('should save progress with version tracking', async () => {
    const now = new Date().toISOString();
    await db('reading_progress').insert({
      user_id: userId,
      book_id: 1,
      position: JSON.stringify({ cfi: 'test-cfi-1' }),
      percentage: 0.25,
      version: 1,
      finished: 0,
      device_id: 'device-a',
      last_read_at: now,
      updated_at: now,
    });

    const progress = await db('reading_progress')
      .where({ user_id: userId, book_id: 1 })
      .first();

    expect(progress.version).toBe(1);
    expect(progress.percentage).toBe(0.25);
    expect(progress.device_id).toBe('device-a');
  });

  it('should allow version upgrade', async () => {
    const now = new Date().toISOString();
    await db('reading_progress')
      .where({ user_id: userId, book_id: 1 })
      .update({
        position: JSON.stringify({ cfi: 'test-cfi-2' }),
        percentage: 0.5,
        version: 2,
        device_id: 'device-b',
        last_read_at: now,
        updated_at: now,
      });

    const progress = await db('reading_progress')
      .where({ user_id: userId, book_id: 1 })
      .first();

    expect(progress.version).toBe(2);
    expect(progress.percentage).toBe(0.5);
    expect(progress.device_id).toBe('device-b');
  });

  it('should detect conflict when client version is lower', async () => {
    const current = await db('reading_progress')
      .where({ user_id: userId, book_id: 1 })
      .first();

    const clientVersion = 1;
    const isConflict = clientVersion < current.version;
    expect(isConflict).toBe(true);
  });

  it('should record progress history', async () => {
    const now = new Date().toISOString();
    await db('progress_history').insert({
      user_id: userId,
      book_id: 1,
      position: JSON.stringify({ cfi: 'history-cfi' }),
      percentage: 0.5,
      version: 2,
      device_id: 'device-b',
      created_at: now,
    });

    const history = await db('progress_history')
      .where({ user_id: userId, book_id: 1 })
      .orderBy('version', 'desc');

    expect(history.length).toBeGreaterThan(0);
    expect(history[0].version).toBe(2);
  });

  it('should support idempotency key deduplication', async () => {
    const key = 'idem-key-001';
    const now = new Date().toISOString();

    await db('idempotency_keys').insert({
      key,
      user_id: userId,
      response: JSON.stringify({ status: 200, body: { accepted: true, version: 3 } }),
      created_at: now,
    });

    const existing = await db('idempotency_keys').where({ key, user_id: userId }).first();
    expect(existing).toBeTruthy();
    expect(JSON.parse(existing.response).body.accepted).toBe(true);

    const duplicate = await db('idempotency_keys').where({ key, user_id: userId }).first();
    expect(duplicate.key).toBe(key);
  });

  it('should mark progress as finished', async () => {
    await db('reading_progress')
      .where({ user_id: userId, book_id: 1 })
      .update({ finished: 1, percentage: 1.0, version: 3 });

    const progress = await db('reading_progress')
      .where({ user_id: userId, book_id: 1 })
      .first();

    expect(progress.finished).toBe(1);
    expect(progress.percentage).toBe(1.0);
  });

  it('should fetch incremental changes since timestamp', async () => {
    const pastTime = new Date(Date.now() - 60000).toISOString();
    const changes = await db('reading_progress')
      .where('user_id', userId)
      .where('updated_at', '>', pastTime);

    expect(changes.length).toBeGreaterThan(0);
  });
});
