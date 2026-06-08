import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
      title,
      author,
      description,
      content='books',
      content_rowid='id',
      tokenize='unicode61'
    )
  `);

  await knex.raw(`
    CREATE TRIGGER IF NOT EXISTS books_ai AFTER INSERT ON books BEGIN
      INSERT INTO books_fts(rowid, title, author, description)
      VALUES (new.id, new.title, new.author, new.description);
    END
  `);

  await knex.raw(`
    CREATE TRIGGER IF NOT EXISTS books_ad AFTER DELETE ON books BEGIN
      INSERT INTO books_fts(books_fts, rowid, title, author, description)
      VALUES ('delete', old.id, old.title, old.author, old.description);
    END
  `);

  await knex.raw(`
    CREATE TRIGGER IF NOT EXISTS books_au AFTER UPDATE ON books BEGIN
      INSERT INTO books_fts(books_fts, rowid, title, author, description)
      VALUES ('delete', old.id, old.title, old.author, old.description);
      INSERT INTO books_fts(rowid, title, author, description)
      VALUES (new.id, new.title, new.author, new.description);
    END
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TRIGGER IF EXISTS books_au');
  await knex.raw('DROP TRIGGER IF EXISTS books_ad');
  await knex.raw('DROP TRIGGER IF EXISTS books_ai');
  await knex.raw('DROP TABLE IF EXISTS books_fts');
}
