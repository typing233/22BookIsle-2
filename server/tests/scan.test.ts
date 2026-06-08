import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, getTestDb } from './helpers/setup';

describe('Scan Service', () => {
  let db: any;

  beforeAll(async () => {
    db = await setupTestDb();
    await db('users').insert({
      username: 'scanadmin',
      password_hash: 'hash',
      role: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await db('libraries').insert({
      name: 'Scan Test Library',
      paths: JSON.stringify(['/tmp/test-books']),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('should create scan jobs', async () => {
    const [jobId] = await db('scan_jobs').insert({
      library_id: 1,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    const job = await db('scan_jobs').where('id', jobId).first();
    expect(job.status).toBe('pending');
    expect(job.library_id).toBe(1);
  });

  it('should update scan progress', async () => {
    await db('scan_jobs').where('id', 1).update({
      status: 'running',
      total_files: 100,
      processed_files: 50,
      new_files: 45,
      started_at: new Date().toISOString(),
    });

    const job = await db('scan_jobs').where('id', 1).first();
    expect(job.status).toBe('running');
    expect(job.processed_files).toBe(50);
    expect(job.new_files).toBe(45);
  });

  it('should save and restore checkpoint', async () => {
    const checkpoint = JSON.stringify({ lastPath: '/tmp/test-books/m-file.epub', timestamp: Date.now() });
    await db('scan_jobs').where('id', 1).update({ checkpoint });

    const job = await db('scan_jobs').where('id', 1).first();
    const parsed = JSON.parse(job.checkpoint);
    expect(parsed.lastPath).toBe('/tmp/test-books/m-file.epub');
  });

  it('should complete scan job', async () => {
    await db('scan_jobs').where('id', 1).update({
      status: 'completed',
      processed_files: 100,
      checkpoint: null,
      completed_at: new Date().toISOString(),
    });

    const job = await db('scan_jobs').where('id', 1).first();
    expect(job.status).toBe('completed');
    expect(job.checkpoint).toBeNull();
  });

  it('should record scan errors without crashing', async () => {
    const errors = JSON.stringify([
      { file: '/tmp/bad.epub', error: 'corrupt file' },
      { file: '/tmp/bad2.pdf', error: 'permission denied' },
    ]);

    await db('scan_jobs').where('id', 1).update({ errors });

    const job = await db('scan_jobs').where('id', 1).first();
    const parsed = JSON.parse(job.errors);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].error).toBe('corrupt file');
  });

  it('should track audit log entries', async () => {
    await db('audit_log').insert({
      user_id: 1,
      action: 'scan_start',
      target_type: 'library',
      target_id: 1,
      details: JSON.stringify({ jobId: 1 }),
      created_at: new Date().toISOString(),
    });

    const entries = await db('audit_log').where('action', 'scan_start');
    expect(entries).toHaveLength(1);
  });
});
