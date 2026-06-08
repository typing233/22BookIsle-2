import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_ratings', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('book_id').notNullable().references('id').inTable('books').onDelete('CASCADE');
    table.float('rating').notNullable();
    table.string('created_at').notNullable().defaultTo(knex.fn.now());
    table.string('updated_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['user_id', 'book_id']);
    table.index('book_id');
  });

  await knex.schema.createTable('user_tags', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('color');
    table.string('created_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['user_id', 'name']);
  });

  await knex.schema.createTable('book_tags', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('book_id').notNullable().references('id').inTable('books').onDelete('CASCADE');
    table.integer('tag_id').notNullable().references('id').inTable('user_tags').onDelete('CASCADE');
    table.string('created_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['user_id', 'book_id', 'tag_id']);
    table.index('book_id');
    table.index('tag_id');
  });

  await knex.schema.alterTable('reading_progress', (table) => {
    table.integer('version').notNullable().defaultTo(1);
    table.string('updated_at');
    table.integer('finished').notNullable().defaultTo(0);
    table.string('device_id');
  });

  await knex.schema.createTable('idempotency_keys', (table) => {
    table.string('key').primary();
    table.integer('user_id').notNullable();
    table.text('response');
    table.string('created_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('progress_history', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable();
    table.integer('book_id').notNullable();
    table.text('position').notNullable();
    table.float('percentage').notNullable();
    table.integer('version').notNullable();
    table.string('device_id');
    table.string('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['user_id', 'book_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('progress_history');
  await knex.schema.dropTableIfExists('idempotency_keys');
  await knex.schema.dropTableIfExists('book_tags');
  await knex.schema.dropTableIfExists('user_tags');
  await knex.schema.dropTableIfExists('user_ratings');

  await knex.schema.alterTable('reading_progress', (table) => {
    table.dropColumn('version');
    table.dropColumn('updated_at');
    table.dropColumn('finished');
    table.dropColumn('device_id');
  });
}
