import knex from 'knex';
import type { Knex } from 'knex';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { logger } from '../utils/logger';

let db: Knex;

const serverRoot = path.resolve(__dirname, '..', '..').includes('dist')
  ? path.resolve(__dirname, '..', '..', '..', '..')
  : path.resolve(__dirname, '..', '..');

export function getDb(): Knex {
  if (!db) {
    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

    db = knex({
      client: 'better-sqlite3',
      connection: {
        filename: config.dbPath,
      },
      useNullAsDefault: true,
      pool: {
        afterCreate: (conn: any, done: Function) => {
          conn.pragma('journal_mode = WAL');
          conn.pragma('foreign_keys = ON');
          conn.pragma('busy_timeout = 5000');
          done();
        },
      },
      migrations: {
        directory: path.resolve(serverRoot, 'migrations'),
      },
      seeds: {
        directory: path.resolve(serverRoot, 'seeds'),
      },
    });

    logger.info(`Database connected: ${config.dbPath}`);
  }
  return db;
}

export async function initializeDb(): Promise<void> {
  const database = getDb();
  await database.migrate.latest();
  logger.info('Database migrations complete');
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.destroy();
    logger.info('Database connection closed');
  }
}

export function createTestDb(): Knex {
  return knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
    pool: {
      afterCreate: (conn: any, done: Function) => {
        conn.pragma('journal_mode = WAL');
        conn.pragma('foreign_keys = ON');
        done();
      },
    },
    migrations: {
      directory: path.resolve(serverRoot, 'migrations'),
    },
    seeds: {
      directory: path.resolve(serverRoot, 'seeds'),
    },
  });
}
