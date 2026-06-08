import type { Knex } from 'knex';
import argon2 from 'argon2';

export async function seed(knex: Knex): Promise<void> {
  const existing = await knex('users').where('username', 'admin').first();
  if (existing) return;

  const passwordHash = await argon2.hash('admin123');
  await knex('users').insert({
    username: 'admin',
    password_hash: passwordHash,
    role: 'admin',
    display_name: 'Administrator',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}
