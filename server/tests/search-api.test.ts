import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from './helpers/setup';
import { createApp } from '../src/app';
import { setDb } from '../src/db/connection';
import { generateAccessToken } from '../src/services/authService';
import request from 'supertest';
import argon2 from 'argon2';

describe('Search API Integration', () => {
  let db: any;
  let app: ReturnType<typeof createApp>;
  let token: string;

  beforeAll(async () => {
    db = await setupTestDb();
    setDb(db);
    app = createApp();

    const hash = await argon2.hash('admin123');
    await db('users').insert({
      username: 'admin',
      password_hash: hash,
      role: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    token = generateAccessToken({ userId: 1, username: 'admin', role: 'admin' as any });

    await db('libraries').insert({
      id: 1,
      name: 'Search Lib',
      paths: JSON.stringify(['/tmp/books']),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const now = new Date().toISOString();
    const books = [
      { id: 1, title: '三体', author: '刘慈欣', format: 'epub' },
      { id: 2, title: '流浪地球', author: '刘慈欣', format: 'epub' },
      { id: 3, title: '红楼梦', author: '曹雪芹', format: 'pdf' },
      { id: 4, title: '西游记', author: '吴承恩', format: 'pdf' },
      { id: 5, title: '进击的巨人', author: '�therr', format: 'cbz' },
    ];
    for (const b of books) {
      await db('books').insert({
        id: b.id,
        library_id: 1,
        file_path: `/tmp/books/${b.id}.${b.format}`,
        file_size: 1024,
        file_mtime: now,
        format: b.format,
        title: b.title,
        author: b.author,
        created_at: now,
        updated_at: now,
      });
    }

    // Set up ratings
    await db('user_ratings').insert({ user_id: 1, book_id: 1, rating: 5, created_at: now, updated_at: now });
    await db('user_ratings').insert({ user_id: 1, book_id: 2, rating: 4, created_at: now, updated_at: now });
    await db('user_ratings').insert({ user_id: 1, book_id: 3, rating: 3, created_at: now, updated_at: now });

    // Set up tags
    const [sciTag] = await db('user_tags').insert({ user_id: 1, name: '科幻', color: '#4fc3f7', created_at: now });
    const [classicTag] = await db('user_tags').insert({ user_id: 1, name: '经典', color: '#a5d6a7', created_at: now });

    await db('book_tags').insert({ user_id: 1, book_id: 1, tag_id: sciTag, created_at: now });
    await db('book_tags').insert({ user_id: 1, book_id: 2, tag_id: sciTag, created_at: now });
    await db('book_tags').insert({ user_id: 1, book_id: 3, tag_id: classicTag, created_at: now });
    await db('book_tags').insert({ user_id: 1, book_id: 4, tag_id: classicTag, created_at: now });

    // Set up reading progress
    await db('reading_progress').insert({
      user_id: 1, book_id: 1, position: '{}', percentage: 0.8,
      version: 1, finished: 0, last_read_at: '2025-06-01T10:00:00Z', updated_at: '2025-06-01T10:00:00Z',
    });
    await db('reading_progress').insert({
      user_id: 1, book_id: 3, position: '{}', percentage: 1.0,
      version: 1, finished: 1, last_read_at: '2025-06-05T10:00:00Z', updated_at: '2025-06-05T10:00:00Z',
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('Tag name search', () => {
    it('should filter books by tag name', async () => {
      const res = await request(app)
        .get(`/api/search?tag_names=${encodeURIComponent('科幻')}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      const titles = res.body.data.map((b: any) => b.title);
      expect(titles).toContain('三体');
      expect(titles).toContain('流浪地球');
    });

    it('should return empty for non-existent tag name', async () => {
      const res = await request(app)
        .get(`/api/search?tag_names=${encodeURIComponent('不存在的标签')}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });

    it('should filter by multiple tag names (AND logic)', async () => {
      const classicTag = await db('user_tags').where({ user_id: 1, name: '经典' }).first();
      await db('book_tags').insert({
        user_id: 1, book_id: 1, tag_id: classicTag.id, created_at: new Date().toISOString(),
      }).onConflict(['user_id', 'book_id', 'tag_id']).ignore();

      const res = await request(app)
        .get(`/api/search?tag_names=${encodeURIComponent('科幻,经典')}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('三体');
    });
  });

  describe('Rating sort', () => {
    it('should sort by rating descending', async () => {
      const res = await request(app)
        .get('/api/search?sort=rating')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(5);
      // First book should be highest rated (5 stars)
      expect(res.body.data[0].title).toBe('三体');
    });

    it('should sort by rating with rating filter combined', async () => {
      const res = await request(app)
        .get('/api/search?sort=rating&rating_min=4')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].title).toBe('三体');
      expect(res.body.data[1].title).toBe('流浪地球');
    });
  });

  describe('Last read sort', () => {
    it('should sort by last read time', async () => {
      const res = await request(app)
        .get('/api/search?sort=last_read')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(5);
      // Most recently read first (红楼梦 was read 2025-06-05)
      expect(res.body.data[0].title).toBe('红楼梦');
      expect(res.body.data[1].title).toBe('三体');
    });

    it('should sort last_read combined with read_status filter', async () => {
      const res = await request(app)
        .get('/api/search?sort=last_read&read_status=reading')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('三体');
    });
  });

  describe('Combined filters', () => {
    it('should combine tag + format filter', async () => {
      const res = await request(app)
        .get(`/api/search?tag_names=${encodeURIComponent('经典')}&format=pdf`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const titles = res.body.data.map((b: any) => b.title);
      expect(titles).toContain('红楼梦');
      expect(titles).toContain('西游记');
    });

    it('should combine rating_min + tag + sort', async () => {
      const res = await request(app)
        .get(`/api/search?tag_names=${encodeURIComponent('科幻')}&rating_min=4&sort=rating`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].title).toBe('三体');
    });

    it('should combine format + author + sort', async () => {
      const res = await request(app)
        .get(`/api/search?author=${encodeURIComponent('刘慈欣')}&sort=rating`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].title).toBe('三体');
      expect(res.body.data[1].title).toBe('流浪地球');
    });

    it('should combine read_status + tag filter', async () => {
      const res = await request(app)
        .get(`/api/search?read_status=finished&tag_names=${encodeURIComponent('经典')}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('红楼梦');
    });

    it('should handle pagination with filters', async () => {
      const res = await request(app)
        .get('/api/search?limit=2&page=1&sort=title')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.total).toBe(5);
      expect(res.body.totalPages).toBe(3);
    });
  });
});
