import knex from 'knex';
import path from 'path';

type Knex = ReturnType<typeof knex>;

let testDb: Knex;

export async function setupTestDb(): Promise<Knex> {
  testDb = knex({
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
      directory: path.resolve(__dirname, '../../migrations'),
    },
  });
  await testDb.migrate.latest();
  return testDb;
}

export async function teardownTestDb(): Promise<void> {
  if (testDb) {
    await testDb.destroy();
  }
}

export function getTestDb(): Knex {
  return testDb;
}
