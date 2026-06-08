import type Knex from 'knex';
import path from 'path';

const dataDir = process.env.DATA_DIR || path.resolve(__dirname, './data');

const config: { [key: string]: Knex.Knex.Config } = {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: path.join(dataDir, 'bookisle.db'),
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(__dirname, './server/migrations'),
      extension: 'ts',
    },
    seeds: {
      directory: path.resolve(__dirname, './server/seeds'),
      extension: 'ts',
    },
  },
  production: {
    client: 'better-sqlite3',
    connection: {
      filename: path.join(dataDir, 'bookisle.db'),
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(__dirname, './server/migrations'),
    },
    seeds: {
      directory: path.resolve(__dirname, './server/seeds'),
    },
  },
  test: {
    client: 'better-sqlite3',
    connection: {
      filename: ':memory:',
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(__dirname, './server/migrations'),
      extension: 'ts',
    },
    seeds: {
      directory: path.resolve(__dirname, './server/seeds'),
      extension: 'ts',
    },
  },
};

export default config;
