import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb } from '../db/connection';
import { extractMetadata } from './metadataService';
import { broadcastScanProgress } from './wsService';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ScanJobStatus } from '../../../shared/types/enums';

const SUPPORTED_EXTENSIONS = new Set(['.epub', '.pdf', '.cbz']);

interface ScanContext {
  jobId: number;
  libraryId: number;
  totalFiles: number;
  processed: number;
  newFiles: number;
  updatedFiles: number;
  deletedFiles: number;
  errors: Array<{ file: string; error: string }>;
  cancelled: boolean;
}

const activeScans = new Map<number, ScanContext>();

export function cancelScan(jobId: number): boolean {
  const ctx = activeScans.get(jobId);
  if (ctx) {
    ctx.cancelled = true;
    return true;
  }
  return false;
}

export async function startScan(libraryId: number): Promise<number> {
  const db = getDb();

  const running = await db('scan_jobs')
    .where({ library_id: libraryId, status: ScanJobStatus.Running })
    .first();
  if (running) {
    throw new Error('A scan is already running for this library');
  }

  const [jobId] = await db('scan_jobs').insert({
    library_id: libraryId,
    status: ScanJobStatus.Pending,
    created_at: new Date().toISOString(),
  });

  setImmediate(() => runScan(jobId, libraryId).catch((err) => {
    logger.error({ err, jobId }, 'Scan failed catastrophically');
  }));

  return jobId;
}

async function runScan(jobId: number, libraryId: number): Promise<void> {
  const db = getDb();

  const library = await db('libraries').where('id', libraryId).first();
  if (!library) {
    await db('scan_jobs').where('id', jobId).update({ status: ScanJobStatus.Failed });
    return;
  }

  const paths: string[] = JSON.parse(library.paths);

  await db('scan_jobs').where('id', jobId).update({
    status: ScanJobStatus.Running,
    started_at: new Date().toISOString(),
  });

  const existingJob = await db('scan_jobs').where('id', jobId).first();
  const checkpoint = existingJob?.checkpoint ? JSON.parse(existingJob.checkpoint) : null;

  const ctx: ScanContext = {
    jobId,
    libraryId,
    totalFiles: 0,
    processed: 0,
    newFiles: 0,
    updatedFiles: 0,
    deletedFiles: 0,
    errors: [],
    cancelled: false,
  };
  activeScans.set(jobId, ctx);

  try {
    const allFiles = collectFiles(paths);
    allFiles.sort();
    ctx.totalFiles = allFiles.length;

    await db('scan_jobs').where('id', jobId).update({ total_files: ctx.totalFiles });
    broadcastScanProgress(libraryId, {
      jobId, libraryId, status: 'running',
      total: ctx.totalFiles, processed: 0, newFiles: 0, errors: 0,
    });

    const existingBooks = await db('books').where('library_id', libraryId).select('file_path', 'file_mtime', 'file_size');
    const existingMap = new Map(existingBooks.map((b: any) => [b.file_path, b]));

    const seenPaths = new Set<string>();

    for (const filePath of allFiles) {
      if (ctx.cancelled) break;

      if (checkpoint && filePath <= checkpoint.lastPath) {
        ctx.processed++;
        seenPaths.add(filePath);
        continue;
      }

      seenPaths.add(filePath);

      try {
        await processFile(filePath, libraryId, existingMap, ctx);
      } catch (err: any) {
        ctx.errors.push({ file: filePath, error: err.message });
        logger.warn({ err, file: filePath }, 'Error processing file');
      }

      ctx.processed++;

      if (ctx.processed % config.scanBatchSize === 0) {
        await saveCheckpoint(jobId, ctx, filePath);
        broadcastScanProgress(libraryId, {
          jobId, libraryId, status: 'running',
          total: ctx.totalFiles, processed: ctx.processed,
          currentFile: path.basename(filePath), newFiles: ctx.newFiles, errors: ctx.errors.length,
        });
      }
    }

    if (!ctx.cancelled) {
      const deletedCount = await detectDeleted(libraryId, seenPaths);
      ctx.deletedFiles = deletedCount;
    }

    const finalStatus = ctx.cancelled ? ScanJobStatus.Cancelled : ScanJobStatus.Completed;
    await db('scan_jobs').where('id', jobId).update({
      status: finalStatus,
      processed_files: ctx.processed,
      new_files: ctx.newFiles,
      updated_files: ctx.updatedFiles,
      deleted_files: ctx.deletedFiles,
      errors: ctx.errors.length > 0 ? JSON.stringify(ctx.errors) : null,
      checkpoint: null,
      completed_at: new Date().toISOString(),
    });

    await db('libraries').where('id', libraryId).update({
      last_scan_at: new Date().toISOString(),
    });

    broadcastScanProgress(libraryId, {
      jobId, libraryId, status: finalStatus,
      total: ctx.totalFiles, processed: ctx.processed,
      newFiles: ctx.newFiles, errors: ctx.errors.length,
    });
  } catch (err: any) {
    logger.error({ err, jobId }, 'Scan error');
    await db('scan_jobs').where('id', jobId).update({
      status: ScanJobStatus.Failed,
      errors: JSON.stringify([{ file: '', error: err.message }]),
      completed_at: new Date().toISOString(),
    });
    broadcastScanProgress(libraryId, {
      jobId, libraryId, status: 'failed',
      total: ctx.totalFiles, processed: ctx.processed,
      newFiles: ctx.newFiles, errors: ctx.errors.length + 1,
    });
  } finally {
    activeScans.delete(jobId);
  }
}

function collectFiles(dirs: string[]): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (SUPPORTED_EXTENSIONS.has(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (err: any) {
      logger.warn({ err, dir }, 'Cannot read directory');
    }
  }

  for (const dir of dirs) {
    if (fs.existsSync(dir)) walk(dir);
  }

  return files;
}

async function processFile(
  filePath: string,
  libraryId: number,
  existingMap: Map<string, any>,
  ctx: ScanContext
): Promise<void> {
  const db = getDb();
  const stat = fs.statSync(filePath);
  const mtime = stat.mtime.toISOString();
  const size = stat.size;
  const ext = path.extname(filePath).toLowerCase().slice(1);

  const existing = existingMap.get(filePath);

  if (existing && existing.file_mtime === mtime && existing.file_size === size) {
    return;
  }

  const fileHash = await computeHash(filePath);

  const duplicate = await db('books')
    .where('file_hash', fileHash)
    .whereNot('file_path', filePath)
    .first();

  let metadata: any = {};
  try {
    metadata = await extractMetadata(filePath, ext);
  } catch (err: any) {
    metadata = fallbackMetadata(filePath);
    ctx.errors.push({ file: filePath, error: `Metadata extraction failed: ${err.message}` });
  }

  const coverPath = metadata.coverPath || null;

  const bookData = {
    library_id: libraryId,
    file_path: filePath,
    file_hash: fileHash,
    file_size: size,
    file_mtime: mtime,
    format: ext,
    title: metadata.title || null,
    author: metadata.author || null,
    description: metadata.description || null,
    cover_path: coverPath,
    page_count: metadata.pageCount || null,
    language: metadata.language || null,
    publisher: metadata.publisher || null,
    publish_date: metadata.publishDate || null,
    metadata_raw: metadata.raw ? JSON.stringify(metadata.raw) : null,
    is_duplicate: duplicate ? 1 : 0,
    duplicate_of: duplicate ? duplicate.id : null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await db('books').where('file_path', filePath).update(bookData);
    ctx.updatedFiles++;
  } else {
    await db('books').insert({ ...bookData, created_at: new Date().toISOString() });
    ctx.newFiles++;
  }
}

function computeHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function detectDeleted(libraryId: number, seenPaths: Set<string>): Promise<number> {
  const db = getDb();
  const dbBooks = await db('books').where('library_id', libraryId).select('id', 'file_path');
  const toDelete: number[] = [];

  for (const book of dbBooks) {
    if (!seenPaths.has(book.file_path)) {
      toDelete.push(book.id);
    }
  }

  if (toDelete.length > 0) {
    await db('books').whereIn('id', toDelete).delete();
  }

  return toDelete.length;
}

async function saveCheckpoint(jobId: number, ctx: ScanContext, lastPath: string): Promise<void> {
  const db = getDb();
  await db('scan_jobs').where('id', jobId).update({
    processed_files: ctx.processed,
    new_files: ctx.newFiles,
    updated_files: ctx.updatedFiles,
    errors: ctx.errors.length > 0 ? JSON.stringify(ctx.errors.slice(-20)) : null,
    checkpoint: JSON.stringify({ lastPath, timestamp: Date.now() }),
  });
}

function fallbackMetadata(filePath: string): any {
  const basename = path.basename(filePath, path.extname(filePath));
  const parts = basename.split(/\s*[-–—]\s*/);

  if (parts.length >= 2) {
    return { title: parts.slice(1).join(' - ').trim(), author: parts[0].trim() };
  }
  return { title: basename.replace(/[_\.]/g, ' ').trim() };
}

export async function getScanStatus(jobId: number) {
  const db = getDb();
  return db('scan_jobs').where('id', jobId).first();
}
