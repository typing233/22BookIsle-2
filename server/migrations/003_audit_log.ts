import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('audit_log', (table) => {
    table.increments('id').primary();
    table.integer('user_id').references('id').inTable('users');
    table.string('action').notNullable();
    table.string('target_type');
    table.integer('target_id');
    table.text('details');
    table.string('ip_address');
    table.string('created_at').notNullable().defaultTo(knex.fn.now());

    table.index('user_id');
    table.index('action');
    table.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_log');
}
