import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

interface MetadataResult {
  title?: string;
  author?: string;
  description?: string;
  coverPath?: string;
  pageCount?: number;
  language?: string;
  publisher?: string;
  publishDate?: string;
  raw?: any;
}

export async function extractMetadata(filePath: string, format: string): Promise<MetadataResult> {
  switch (format) {
    case 'epub':
      return extractEpubMetadata(filePath);
    case 'pdf':
      return extractPdfMetadata(filePath);
    case 'cbz':
      return extractCbzMetadata(filePath);
    default:
      return fallbackMetadata(filePath);
  }
}

async function extractEpubMetadata(filePath: string): Promise<MetadataResult> {
  try {
    const EPub = require('epub2').default || require('epub2');
    const epub = await EPub.createAsync(filePath);

    const metadata = epub.metadata || {};
    let coverPath: string | undefined;

    try {
      const coverId = epub.metadata?.cover || findCoverId(epub);
      if (coverId) {
        const coverData = await getCoverFromEpub(epub, coverId);
        if (coverData) {
          coverPath = await saveCover(filePath, coverData.data, coverData.mimeType);
        }
      }
    } catch (err) {
      logger.debug({ err, file: filePath }, 'Could not extract EPUB cover');
    }

    return {
      title: metadata.title,
      author: metadata.creator || metadata.author,
      description: metadata.description,
      coverPath,
      language: metadata.language,
      publisher: metadata.publisher,
      publishDate: metadata.date,
      raw: metadata,
    };
  } catch (err) {
    logger.warn({ err, file: filePath }, 'EPUB metadata extraction failed');
    return fallbackMetadata(filePath);
  }
}

function findCoverId(epub: any): string | null {
  if (epub.manifest) {
    for (const [id, item] of Object.entries(epub.manifest) as any) {
      if (item.properties === 'cover-image' ||
          id.toLowerCase().includes('cover') ||
          (item.href && item.href.toLowerCase().includes('cover'))) {
        return id;
      }
    }
  }
  return null;
}

function getCoverFromEpub(epub: any, coverId: string): Promise<{ data: Buffer; mimeType: string } | null> {
  return new Promise((resolve) => {
    epub.getImage(coverId, (err: any, data: Buffer, mimeType: string) => {
      if (err || !data) {
        resolve(null);
      } else {
        resolve({ data, mimeType });
      }
    });
  });
}

async function extractPdfMetadata(filePath: string): Promise<MetadataResult> {
  try {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer, { max: 0 });

    const info = data.info || {};

    return {
      title: info.Title,
      author: info.Author,
      description: info.Subject,
      pageCount: data.numpages,
      language: info.Language,
      publisher: info.Producer,
      publishDate: info.CreationDate,
      raw: info,
    };
  } catch (err) {
    logger.warn({ err, file: filePath }, 'PDF metadata extraction failed');
    return fallbackMetadata(filePath);
  }
}

async function extractCbzMetadata(filePath: string): Promise<MetadataResult> {
  try {
    const yauzl = require('yauzl');
    const entries = await listZipEntries(filePath);

    const imageEntries = entries
      .filter((e: string) => /\.(jpe?g|png|gif|webp)$/i.test(e))
      .sort();

    let coverPath: string | undefined;
    if (imageEntries.length > 0) {
      const firstImage = imageEntries[0];
      const imageData = await extractZipEntry(filePath, firstImage);
      if (imageData) {
        const ext = path.extname(firstImage).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
        coverPath = await saveCover(filePath, imageData, mimeType);
      }
    }

    return {
      title: path.basename(filePath, '.cbz').replace(/[_\.]/g, ' '),
      pageCount: imageEntries.length,
      coverPath,
    };
  } catch (err) {
    logger.warn({ err, file: filePath }, 'CBZ metadata extraction failed');
    return fallbackMetadata(filePath);
  }
}

function listZipEntries(filePath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const yauzl = require('yauzl');
    yauzl.open(filePath, { lazyEntries: true }, (err: any, zipfile: any) => {
      if (err) { reject(err); return; }
      const entries: string[] = [];
      zipfile.readEntry();
      zipfile.on('entry', (entry: any) => {
        if (!/\/$/.test(entry.fileName)) {
          entries.push(entry.fileName);
        }
        zipfile.readEntry();
      });
      zipfile.on('end', () => resolve(entries));
      zipfile.on('error', reject);
    });
  });
}

function extractZipEntry(filePath: string, entryName: string): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const yauzl = require('yauzl');
    yauzl.open(filePath, { lazyEntries: true }, (err: any, zipfile: any) => {
      if (err) { reject(err); return; }
      zipfile.readEntry();
      zipfile.on('entry', (entry: any) => {
        if (entry.fileName === entryName) {
          zipfile.openReadStream(entry, (err: any, stream: any) => {
            if (err) { resolve(null); return; }
            const chunks: Buffer[] = [];
            stream.on('data', (chunk: Buffer) => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', () => resolve(null));
          });
        } else {
          zipfile.readEntry();
        }
      });
      zipfile.on('end', () => resolve(null));
      zipfile.on('error', reject);
    });
  });
}

async function saveCover(sourceFile: string, data: Buffer, mimeType: string): Promise<string> {
  fs.mkdirSync(config.coverDir, { recursive: true });

  const hash = crypto.createHash('md5').update(sourceFile).digest('hex');
  const ext = mimeType.includes('png') ? '.png' : '.jpg';
  const filename = `${hash}${ext}`;
  const coverPath = path.join(config.coverDir, filename);

  try {
    const sharp = require('sharp');
    await sharp(data)
      .resize(300, 400, { fit: 'inside', withoutEnlargement: true })
      .toFile(coverPath);
  } catch {
    fs.writeFileSync(coverPath, data);
  }

  return filename;
}

function fallbackMetadata(filePath: string): MetadataResult {
  const basename = path.basename(filePath, path.extname(filePath));
  const parts = basename.split(/\s*[-–—]\s*/);

  if (parts.length >= 2) {
    return { title: parts.slice(1).join(' - ').trim(), author: parts[0].trim() };
  }
  return { title: basename.replace(/[_\.]/g, ' ').trim() };
}
