import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('metadata_history', (table) => {
    table.increments('id').primary();
    table.integer('book_id').notNullable().references('id').inTable('books').onDelete('CASCADE');
    table.integer('user_id').notNullable().references('id').inTable('users');
    table.string('field_name').notNullable();
    table.text('old_value');
    table.text('new_value');
    table.string('batch_id');
    table.string('created_at').notNullable().defaultTo(knex.fn.now());
    table.index('book_id');
    table.index('batch_id');
  });

  await knex.schema.createTable('metadata_templates', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('pattern').notNullable();
    table.text('field_mapping').notNullable();
    table.text('example');
    table.string('created_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('api_tokens', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('token_hash').notNullable().unique();
    table.text('scopes').notNullable();
    table.string('last_used_at');
    table.string('expires_at');
    table.string('created_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('reading_stats', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('book_id').notNullable().references('id').inTable('books').onDelete('CASCADE');
    table.string('date').notNullable();
    table.integer('duration_seconds').notNullable().defaultTo(0);
    table.integer('pages_read').notNullable().defaultTo(0);
    table.integer('sessions').notNullable().defaultTo(1);
    table.unique(['user_id', 'book_id', 'date']);
    table.index(['user_id', 'date']);
  });

  await knex.schema.alterTable('users', (table) => {
    table.text('preferences');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('reading_stats');
  await knex.schema.dropTableIfExists('api_tokens');
  await knex.schema.dropTableIfExists('metadata_templates');
  await knex.schema.dropTableIfExists('metadata_history');

  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('preferences');
  });
}
