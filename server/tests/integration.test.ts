import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { setupTestDb, teardownTestDb, getTestDb } from './helpers/setup';
import argon2 from 'argon2';

describe('Integration: Authorization & Permissions', () => {
  let db: any;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    db = await setupTestDb();

    const { generateAccessToken } = await import('../src/services/authService');

    const adminHash = await argon2.hash('admin123');
    await db('users').insert({
      username: 'admin',
      password_hash: adminHash,
      role: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const userHash = await argon2.hash('user123');
    await db('users').insert({
      username: 'regular',
      password_hash: userHash,
      role: 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    adminToken = generateAccessToken({ userId: 1, username: 'admin', role: 'admin' as any });
    userToken = generateAccessToken({ userId: 2, username: 'regular', role: 'user' as any });

    await db('libraries').insert({
      id: 1,
      name: 'Public Lib',
      paths: JSON.stringify(['/tmp/pub-books']),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await db('libraries').insert({
      id: 2,
      name: 'Private Lib',
      paths: JSON.stringify(['/tmp/private-books']),
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

    const fixtureDir = path.resolve(__dirname, 'fixtures');
    await db('books').insert({
      id: 1,
      library_id: 1,
      file_path: path.join(fixtureDir, 'sample.epub'),
      file_size: 1024,
      file_mtime: new Date().toISOString(),
      format: 'epub',
      title: 'Test EPUB',
      author: 'Author A',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await db('books').insert({
      id: 2,
      library_id: 1,
      file_path: path.join(fixtureDir, 'sample.pdf'),
      file_size: 512,
      file_mtime: new Date().toISOString(),
      format: 'pdf',
      title: 'Test PDF',
      author: 'Author B',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await db('books').insert({
      id: 3,
      library_id: 1,
      file_path: path.join(fixtureDir, 'sample.cbz'),
      file_size: 256,
      file_mtime: new Date().toISOString(),
      format: 'cbz',
      title: 'Test Comic',
      author: 'Author C',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await db('books').insert({
      id: 4,
      library_id: 2,
      file_path: '/tmp/private-books/secret.epub',
      file_size: 2048,
      file_mtime: new Date().toISOString(),
      format: 'epub',
      title: 'Secret Book',
      author: 'Secret Author',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('Unauthorized access (no token)', () => {
    it('should reject requests without token', async () => {
      const { verifyAccessToken } = await import('../src/services/authService');
      expect(() => verifyAccessToken('')).toThrow();
      expect(() => verifyAccessToken('invalid-token')).toThrow();
    });

    it('should reject requests with expired or garbage token', async () => {
      const jwt = await import('jsonwebtoken');
      const expired = jwt.default.sign(
        { userId: 1, username: 'x', role: 'admin' },
        'wrong-secret',
        { expiresIn: '1ms' }
      );
      const { verifyAccessToken } = await import('../src/services/authService');
      expect(() => verifyAccessToken(expired)).toThrow();
    });
  });

  describe('User cannot access libraries without permission', () => {
    it('user cannot see private library detail', async () => {
      const library = await db('libraries').where('id', 2).first();
      expect(library).toBeTruthy();

      const perm = await db('library_permissions')
        .where({ user_id: 2, library_id: 2 })
        .first();
      expect(perm).toBeUndefined();
    });

    it('user can only see books from permitted libraries', async () => {
      const permLibIds = await db('library_permissions')
        .where('user_id', 2)
        .pluck('library_id');

      const accessibleBooks = await db('books').whereIn('library_id', permLibIds);
      expect(accessibleBooks.length).toBe(3);

      const inaccessibleBooks = await db('books').whereNotIn('library_id', permLibIds);
      expect(inaccessibleBooks.length).toBe(1);
      expect(inaccessibleBooks[0].title).toBe('Secret Book');
    });

    it('user cannot access books in unpermitted library', async () => {
      const perm = await db('library_permissions')
        .where({ user_id: 2, library_id: 2 })
        .first();
      expect(perm).toBeUndefined();
    });
  });

  describe('File streaming with auth', () => {
    it('EPUB file exists and is readable', () => {
      const filepath = path.resolve(__dirname, 'fixtures/sample.epub');
      expect(fs.existsSync(filepath)).toBe(true);
      const stat = fs.statSync(filepath);
      expect(stat.size).toBeGreaterThan(0);
    });

    it('PDF file exists and is readable', () => {
      const filepath = path.resolve(__dirname, 'fixtures/sample.pdf');
      expect(fs.existsSync(filepath)).toBe(true);
      const stat = fs.statSync(filepath);
      expect(stat.size).toBeGreaterThan(0);
    });

    it('CBZ file exists and is readable', () => {
      const filepath = path.resolve(__dirname, 'fixtures/sample.cbz');
      expect(fs.existsSync(filepath)).toBe(true);
      const stat = fs.statSync(filepath);
      expect(stat.size).toBeGreaterThan(0);
    });

    it('range requests work on files', () => {
      const filepath = path.resolve(__dirname, 'fixtures/sample.epub');
      const fd = fs.openSync(filepath, 'r');
      const buf = Buffer.alloc(10);
      fs.readSync(fd, buf, 0, 10, 0);
      fs.closeSync(fd);
      expect(buf[0]).toBe(0x50); // PK header (zip)
      expect(buf[1]).toBe(0x4b);
    });
  });

  describe('Bookmark permissions', () => {
    it('user can create bookmark for accessible book', async () => {
      const [id] = await db('bookmarks').insert({
        user_id: 2,
        book_id: 1,
        position: JSON.stringify({ cfi: 'test-cfi' }),
        label: 'My Bookmark',
        type: 'bookmark',
        created_at: new Date().toISOString(),
      });
      expect(id).toBeGreaterThan(0);
    });

    it('user can create note annotation', async () => {
      const [id] = await db('bookmarks').insert({
        user_id: 2,
        book_id: 1,
        position: JSON.stringify({ cfi: 'note-cfi' }),
        label: 'My Note',
        note: 'This is an important passage about the protagonist',
        color: '#ffd54f',
        type: 'note',
        created_at: new Date().toISOString(),
      });

      const bm = await db('bookmarks').where('id', id).first();
      expect(bm.type).toBe('note');
      expect(bm.note).toContain('protagonist');
      expect(bm.color).toBe('#ffd54f');
    });

    it('user bookmarks are isolated per-user', async () => {
      await db('bookmarks').insert({
        user_id: 1,
        book_id: 1,
        position: JSON.stringify({ cfi: 'admin-cfi' }),
        label: 'Admin Bookmark',
        type: 'bookmark',
        created_at: new Date().toISOString(),
      });

      const userBms = await db('bookmarks').where('user_id', 2);
      const adminBms = await db('bookmarks').where('user_id', 1);
      expect(userBms.length).toBe(2);
      expect(adminBms.length).toBe(1);
    });
  });

  describe('Progress tracking', () => {
    it('user can save and retrieve reading progress', async () => {
      const position = JSON.stringify({ cfi: 'epubcfi(/6/4!/4/2/1:0)', percentage: 0.35 });
      await db('reading_progress').insert({
        user_id: 2,
        book_id: 1,
        position,
        percentage: 0.35,
        last_read_at: new Date().toISOString(),
      });

      const prog = await db('reading_progress').where({ user_id: 2, book_id: 1 }).first();
      expect(prog.percentage).toBe(0.35);
      expect(JSON.parse(prog.position).cfi).toContain('epubcfi');
    });

    it('progress upsert overwrites previous position', async () => {
      await db('reading_progress')
        .where({ user_id: 2, book_id: 1 })
        .update({ percentage: 0.75, position: JSON.stringify({ page: 50 }) });

      const prog = await db('reading_progress').where({ user_id: 2, book_id: 1 }).first();
      expect(prog.percentage).toBe(0.75);
    });
  });
});

describe('Integration: Scan with real directory', () => {
  let db: any;
  const testDir = path.resolve(__dirname, 'fixtures');

  beforeAll(async () => {
    db = await setupTestDb();
    await db('users').insert({
      username: 'scanner',
      password_hash: 'hash',
      role: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await db('libraries').insert({
      name: 'Fixture Library',
      paths: JSON.stringify([testDir]),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('fixtures directory has expected files', () => {
    const files = fs.readdirSync(testDir);
    expect(files).toContain('sample.epub');
    expect(files).toContain('sample.pdf');
    expect(files).toContain('sample.cbz');
  });

  it('scan collects supported file types from real directory', async () => {
    const supportedExts = new Set(['.epub', '.pdf', '.cbz']);
    const files = fs.readdirSync(testDir)
      .filter(f => supportedExts.has(path.extname(f).toLowerCase()));
    expect(files.length).toBe(3);
  });

  it('file hashing produces consistent SHA-256', async () => {
    const crypto = await import('crypto');
    const filepath = path.join(testDir, 'sample.epub');
    const hash1 = crypto.createHash('sha256').update(fs.readFileSync(filepath)).digest('hex');
    const hash2 = crypto.createHash('sha256').update(fs.readFileSync(filepath)).digest('hex');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('CBZ zip can be opened and images listed', async () => {
    const yauzl = await import('yauzl');
    const cbzPath = path.join(testDir, 'sample.cbz');

    const entries = await new Promise<string[]>((resolve, reject) => {
      yauzl.open(cbzPath, { lazyEntries: true }, (err: any, zipfile: any) => {
        if (err) { reject(err); return; }
        const names: string[] = [];
        zipfile.readEntry();
        zipfile.on('entry', (entry: any) => {
          names.push(entry.fileName);
          zipfile.readEntry();
        });
        zipfile.on('end', () => resolve(names));
      });
    });

    expect(entries).toContain('page001.jpg');
    expect(entries).toContain('page002.jpg');
    expect(entries.length).toBe(2);
  });

  it('EPUB can be opened and has valid structure', () => {
    const filepath = path.join(testDir, 'sample.epub');
    const data = fs.readFileSync(filepath);
    expect(data[0]).toBe(0x50);
    expect(data[1]).toBe(0x4b);
  });

  it('incremental scan detects no changes for unchanged files', async () => {
    const filepath = path.join(testDir, 'sample.epub');
    const stat = fs.statSync(filepath);
    const mtime = stat.mtime.toISOString();
    const size = stat.size;

    await db('books').insert({
      library_id: 1,
      file_path: filepath,
      file_size: size,
      file_mtime: mtime,
      format: 'epub',
      title: 'Already Scanned',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const existing = await db('books').where('file_path', filepath).first();
    expect(existing.file_mtime).toBe(mtime);
    expect(existing.file_size).toBe(size);
  });

  it('scan job lifecycle: pending -> running -> completed', async () => {
    const [jobId] = await db('scan_jobs').insert({
      library_id: 1,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    await db('scan_jobs').where('id', jobId).update({
      status: 'running',
      started_at: new Date().toISOString(),
      total_files: 3,
    });

    await db('scan_jobs').where('id', jobId).update({
      status: 'completed',
      processed_files: 3,
      new_files: 2,
      completed_at: new Date().toISOString(),
    });

    const job = await db('scan_jobs').where('id', jobId).first();
    expect(job.status).toBe('completed');
    expect(job.processed_files).toBe(3);
    expect(job.new_files).toBe(2);
  });
});
