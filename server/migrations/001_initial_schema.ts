import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('username').notNullable().unique();
    table.string('password_hash').notNullable();
    table.string('role').notNullable().defaultTo('user');
    table.string('display_name');
    table.string('created_at').notNullable().defaultTo(knex.fn.now());
    table.string('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('libraries', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.text('paths').notNullable();
    table.string('scan_schedule');
    table.string('last_scan_at');
    table.text('last_scan_state');
    table.string('created_at').notNullable().defaultTo(knex.fn.now());
    table.string('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('library_permissions', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('library_id').notNullable().references('id').inTable('libraries').onDelete('CASCADE');
    table.string('permission').notNullable();
    table.integer('granted_by').references('id').inTable('users');
    table.string('created_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['user_id', 'library_id']);
  });

  await knex.schema.createTable('books', (table) => {
    table.increments('id').primary();
    table.integer('library_id').notNullable().references('id').inTable('libraries').onDelete('CASCADE');
    table.string('file_path').notNullable().unique();
    table.string('file_hash');
    table.integer('file_size').notNullable();
    table.string('file_mtime').notNullable();
    table.string('format').notNullable();
    table.string('title');
    table.string('author');
    table.text('description');
    table.string('cover_path');
    table.integer('page_count');
    table.string('language');
    table.string('publisher');
    table.string('publish_date');
    table.text('metadata_raw');
    table.integer('is_duplicate').notNullable().defaultTo(0);
    table.integer('duplicate_of').references('id').inTable('books');
    table.string('created_at').notNullable().defaultTo(knex.fn.now());
    table.string('updated_at').notNullable().defaultTo(knex.fn.now());

    table.index('library_id');
    table.index('file_hash');
    table.index('format');
  });

  await knex.schema.createTable('reading_progress', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('book_id').notNullable().references('id').inTable('books').onDelete('CASCADE');
    table.text('position').notNullable();
    table.float('percentage').notNullable().defaultTo(0);
    table.string('last_read_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['user_id', 'book_id']);

    table.index('user_id');
    table.index('book_id');
  });

  await knex.schema.createTable('bookmarks', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('book_id').notNullable().references('id').inTable('books').onDelete('CASCADE');
    table.text('position').notNullable();
    table.string('label');
    table.text('note');
    table.string('color');
    table.string('type').notNullable().defaultTo('bookmark');
    table.string('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['user_id', 'book_id']);
  });

  await knex.schema.createTable('scan_jobs', (table) => {
    table.increments('id').primary();
    table.integer('library_id').notNullable().references('id').inTable('libraries').onDelete('CASCADE');
    table.string('status').notNullable().defaultTo('pending');
    table.integer('total_files').defaultTo(0);
    table.integer('processed_files').defaultTo(0);
    table.integer('new_files').defaultTo(0);
    table.integer('updated_files').defaultTo(0);
    table.integer('deleted_files').defaultTo(0);
    table.text('errors');
    table.text('checkpoint');
    table.string('started_at');
    table.string('completed_at');
    table.string('created_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('scan_jobs');
  await knex.schema.dropTableIfExists('bookmarks');
  await knex.schema.dropTableIfExists('reading_progress');
  await knex.schema.dropTableIfExists('books');
  await knex.schema.dropTableIfExists('library_permissions');
  await knex.schema.dropTableIfExists('libraries');
  await knex.schema.dropTableIfExists('users');
}
