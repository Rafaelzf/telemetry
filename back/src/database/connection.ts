import knexFactory from 'knex';
import type { Knex } from 'knex';
import { env } from '../config/env.js';

export const db: Knex = knexFactory({
  client: 'pg',
  connection: env.DATABASE_URL,
  pool: { min: 2, max: 10 }
});

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.raw('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  await db.destroy();
}
