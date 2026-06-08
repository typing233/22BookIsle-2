import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from './helpers/setup';
import argon2 from 'argon2';

describe('Ratings & Tags', () => {
  let db: any;
  let userId1: number;
  let userId2: number;

  beforeAll(async () => {
    db = await setupTestDb();

    const hash = await argon2.hash('test123');
    const [id1] = await db('users').insert({
      username: 'user1',
      password_hash: hash,
      role: 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    userId1 = id1;

    const [id2] = await db('users').insert({
      username: 'user2',
      password_hash: hash,
      role: 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    userId2 = id2;

    await db('libraries').insert({
      id: 1,
      name: 'Test Lib',
      paths: JSON.stringify(['/tmp/books']),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    for (let i = 1; i <= 5; i++) {
      await db('books').insert({
        id: i,
        library_id: 1,
        file_path: `/tmp/books/book${i}.epub`,
        file_size: 1024,
        file_mtime: new Date().toISOString(),
        format: 'epub',
        title: `Book ${i}`,
        author: `Author ${i}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('Ratings', () => {
    it('should create a rating', async () => {
      const now = new Date().toISOString();
      const [id] = await db('user_ratings').insert({
        user_id: userId1,
        book_id: 1,
        rating: 4.5,
        created_at: now,
        updated_at: now,
      });
      expect(id).toBeGreaterThan(0);
    });

    it('should enforce unique user+book constraint', async () => {
      const now = new Date().toISOString();
      await expect(
        db('user_ratings').insert({
          user_id: userId1,
          book_id: 1,
          rating: 3.0,
          created_at: now,
          updated_at: now,
        })
      ).rejects.toThrow();
    });

    it('should isolate ratings between users', async () => {
      const now = new Date().toISOString();
      await db('user_ratings').insert({
        user_id: userId2,
        book_id: 1,
        rating: 2.0,
        created_at: now,
        updated_at: now,
      });

      const r1 = await db('user_ratings').where({ user_id: userId1, book_id: 1 }).first();
      const r2 = await db('user_ratings').where({ user_id: userId2, book_id: 1 }).first();

      expect(r1.rating).toBe(4.5);
      expect(r2.rating).toBe(2.0);
    });

    it('should support batch ratings', async () => {
      const now = new Date().toISOString();
      for (const bookId of [2, 3, 4]) {
        await db('user_ratings')
          .insert({ user_id: userId1, book_id: bookId, rating: 3.0, created_at: now, updated_at: now })
          .onConflict(['user_id', 'book_id'])
          .merge({ rating: 3.0, updated_at: now });
      }

      const ratings = await db('user_ratings').where('user_id', userId1);
      expect(ratings.length).toBe(4);
    });
  });

  describe('Tags', () => {
    it('should create user tags', async () => {
      const now = new Date().toISOString();
      const [id] = await db('user_tags').insert({
        user_id: userId1,
        name: '科幻',
        color: '#4fc3f7',
        created_at: now,
      });
      expect(id).toBeGreaterThan(0);
    });

    it('should enforce unique user+name constraint', async () => {
      await expect(
        db('user_tags').insert({
          user_id: userId1,
          name: '科幻',
          color: '#ff0000',
          created_at: new Date().toISOString(),
        })
      ).rejects.toThrow();
    });

    it('should allow same tag name for different users', async () => {
      const [id] = await db('user_tags').insert({
        user_id: userId2,
        name: '科幻',
        color: '#ce93d8',
        created_at: new Date().toISOString(),
      });
      expect(id).toBeGreaterThan(0);
    });

    it('should assign tags to books', async () => {
      const tag = await db('user_tags').where({ user_id: userId1, name: '科幻' }).first();
      const now = new Date().toISOString();

      await db('book_tags').insert({
        user_id: userId1,
        book_id: 1,
        tag_id: tag.id,
        created_at: now,
      });

      const bookTags = await db('book_tags')
        .where({ 'book_tags.user_id': userId1, 'book_tags.book_id': 1 })
        .join('user_tags', 'book_tags.tag_id', 'user_tags.id')
        .select('user_tags.name');

      expect(bookTags.length).toBe(1);
      expect(bookTags[0].name).toBe('科幻');
    });

    it('should support batch tag operations', async () => {
      const [tagId] = await db('user_tags').insert({
        user_id: userId1,
        name: '推荐',
        color: '#aed581',
        created_at: new Date().toISOString(),
      });
      const now = new Date().toISOString();

      for (const bookId of [1, 2, 3]) {
        await db('book_tags')
          .insert({ user_id: userId1, book_id: bookId, tag_id: tagId, created_at: now })
          .onConflict(['user_id', 'book_id', 'tag_id'])
          .ignore();
      }

      const tagged = await db('book_tags').where({ user_id: userId1, tag_id: tagId });
      expect(tagged.length).toBe(3);
    });

    it('should cascade delete tags when user tag is removed', async () => {
      const tag = await db('user_tags').where({ user_id: userId1, name: '推荐' }).first();
      await db('user_tags').where('id', tag.id).delete();

      const remaining = await db('book_tags').where('tag_id', tag.id);
      expect(remaining.length).toBe(0);
    });

    it('user tags are isolated', async () => {
      const user1Tags = await db('user_tags').where('user_id', userId1);
      const user2Tags = await db('user_tags').where('user_id', userId2);

      expect(user1Tags.length).toBe(1);
      expect(user2Tags.length).toBe(1);
      expect(user1Tags[0].name).toBe(user2Tags[0].name);
    });
  });
});
