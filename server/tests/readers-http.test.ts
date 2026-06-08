import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from './helpers/setup';
import { createApp } from '../src/app';
import { setDb } from '../src/db/connection';
import { generateAccessToken } from '../src/services/authService';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import argon2 from 'argon2';

describe('Reader HTTP Integration', () => {
  let db: any;
  let app: ReturnType<typeof createApp>;
  let adminToken: string;
  let userToken: string;
  const fixtureDir = path.resolve(__dirname, '__fixtures__');
  const pdfPath = path.join(fixtureDir, 'test-range.pdf');
  const cbzPath = path.join(fixtureDir, 'test-comic.cbz');

  beforeAll(async () => {
    db = await setupTestDb();
    setDb(db);
    app = createApp();

    if (!fs.existsSync(fixtureDir)) fs.mkdirSync(fixtureDir, { recursive: true });

    // Create a 10KB PDF fixture
    const pdfContent = Buffer.alloc(10240);
    for (let i = 0; i < pdfContent.length; i++) pdfContent[i] = i % 256;
    fs.writeFileSync(pdfPath, pdfContent);

    // Create a small CBZ fixture
    const cbzContent = Buffer.alloc(4096, 0x42);
    fs.writeFileSync(cbzPath, cbzContent);

    const hash = await argon2.hash('admin123');
    await db('users').insert({
      username: 'admin',
      password_hash: hash,
      role: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await db('users').insert({
      username: 'reader',
      password_hash: hash,
      role: 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await db('libraries').insert({
      id: 1,
      name: 'Test Lib',
      paths: JSON.stringify([fixtureDir]),
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

    await db('books').insert({
      id: 1,
      library_id: 1,
      file_path: pdfPath,
      file_size: 10240,
      file_mtime: new Date().toISOString(),
      format: 'pdf',
      title: 'Range Test PDF',
      author: 'Author',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await db('books').insert({
      id: 2,
      library_id: 1,
      file_path: cbzPath,
      file_size: 4096,
      file_mtime: new Date().toISOString(),
      format: 'cbz',
      title: 'Comic Test',
      author: 'Artist',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    adminToken = generateAccessToken({ userId: 1, username: 'admin', role: 'admin' as any });
    userToken = generateAccessToken({ userId: 2, username: 'reader', role: 'user' as any });
  });

  afterAll(async () => {
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    if (fs.existsSync(cbzPath)) fs.unlinkSync(cbzPath);
    await teardownTestDb();
  });

  describe('PDF Range Streaming', () => {
    it('should serve full PDF without Range header', async () => {
      const res = await request(app)
        .get('/api/books/1/file')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(Number(res.headers['content-length'])).toBe(10240);
    });

    it('should return 206 Partial Content for Range request', async () => {
      const res = await request(app)
        .get('/api/books/1/file')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Range', 'bytes=0-1023');

      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toBe('bytes 0-1023/10240');
      expect(Number(res.headers['content-length'])).toBe(1024);
      expect(res.body.length).toBe(1024);
    });

    it('should serve middle range correctly', async () => {
      const res = await request(app)
        .get('/api/books/1/file')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Range', 'bytes=5120-6143');

      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toBe('bytes 5120-6143/10240');
      expect(Number(res.headers['content-length'])).toBe(1024);
      // Verify actual bytes match the fixture
      for (let i = 0; i < res.body.length; i++) {
        expect(res.body[i]).toBe((5120 + i) % 256);
      }
    });

    it('should serve open-ended range (bytes=8192-)', async () => {
      const res = await request(app)
        .get('/api/books/1/file')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Range', 'bytes=8192-');

      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toBe('bytes 8192-10239/10240');
      expect(Number(res.headers['content-length'])).toBe(2048);
    });

    it('should enforce access control on file endpoint', async () => {
      // Remove permission for user 2 temporarily
      await db('library_permissions').where({ user_id: 2, library_id: 1 }).delete();

      const res = await request(app)
        .get('/api/books/1/file')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);

      // Restore permission
      await db('library_permissions').insert({
        user_id: 2,
        library_id: 1,
        permission: 'read',
        granted_by: 1,
        created_at: new Date().toISOString(),
      });
    });

    it('should serve PDF Range to authorized non-admin user', async () => {
      const res = await request(app)
        .get('/api/books/1/file')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Range', 'bytes=0-511');

      expect(res.status).toBe(206);
      expect(Number(res.headers['content-length'])).toBe(512);
    });
  });

  describe('Comic Reader File Serving', () => {
    it('should serve CBZ with correct MIME type', async () => {
      const res = await request(app)
        .get('/api/books/2/file')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/x-cbz');
      expect(res.headers['accept-ranges']).toBe('bytes');
    });

    it('should support Range request on CBZ for progressive loading', async () => {
      const res = await request(app)
        .get('/api/books/2/file')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Range', 'bytes=0-2047');

      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toBe('bytes 0-2047/4096');
    });
  });

  describe('Comic Double-Page/RTL Progress Sync', () => {
    it('should save and retrieve double-page RTL position', async () => {
      const position = JSON.stringify({
        imageIndex: 6,
        viewMode: 'double',
        direction: 'rtl',
      });

      const saveRes = await request(app)
        .put('/api/progress/2')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ position, percentage: 0.6 });

      expect(saveRes.status).toBe(200);
      expect(saveRes.body.accepted).toBe(true);

      const getRes = await request(app)
        .get('/api/progress/2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      const pos = JSON.parse(getRes.body.position);
      expect(pos.imageIndex).toBe(6);
      expect(pos.viewMode).toBe('double');
      expect(pos.direction).toBe('rtl');
      expect(getRes.body.percentage).toBe(0.6);
    });

    it('should switch between single and double page modes', async () => {
      const position = JSON.stringify({
        imageIndex: 3,
        viewMode: 'single',
        direction: 'ltr',
      });

      const res = await request(app)
        .put('/api/progress/2')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ position, percentage: 0.3, version: 2 });

      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(true);
      expect(res.body.version).toBe(2);
    });
  });

  describe('Context Menu and Keyboard Shortcuts (progress API)', () => {
    it('should save position after keyboard navigation (PageDown)', async () => {
      const position = JSON.stringify({ page: 42, scrollY: 0, source: 'keyboard' });

      const res = await request(app)
        .put('/api/progress/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ position, percentage: 0.42 });

      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(true);
    });

    it('should save bookmark from context menu action', async () => {
      const res = await request(app)
        .post('/api/bookmarks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          book_id: 1,
          position: JSON.stringify({ page: 42, scrollY: 100 }),
          label: '右键菜单添加',
          type: 'bookmark',
        });

      expect(res.status).toBe(201);

      const listRes = await request(app)
        .get('/api/bookmarks?book_id=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.length).toBeGreaterThan(0);
      expect(listRes.body.some((b: any) => b.label === '右键菜单添加')).toBe(true);
    });

    it('should handle rapid position updates (keyboard held)', async () => {
      for (let page = 43; page <= 47; page++) {
        const res = await request(app)
          .put('/api/progress/1')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            position: JSON.stringify({ page, scrollY: 0 }),
            percentage: page / 100,
            version: page,
          });
        expect(res.status).toBe(200);
        expect(res.body.accepted).toBe(true);
      }

      const final = await request(app)
        .get('/api/progress/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(final.status).toBe(200);
      expect(JSON.parse(final.body.position).page).toBe(47);
    });
  });
});
