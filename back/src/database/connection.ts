import knexFactory from 'knex';
import type { Knex } from 'knex';
import { env } from '../config/env.js';

// Managed Postgres providers (Supabase included) require TLS; local dev
// databases typically don't have it configured, so only enable it for
// non-local hosts. rejectUnauthorized: false trusts the provider's cert
// without pinning its CA chain, which is the common pragmatic setup for
// Supabase (see https://supabase.com/docs/guides/database/ssl-enforcement).
const isLocalDatabase = /(localhost|127\.0\.0\.1)/.test(env.DATABASE_URL);

export const db: Knex = knexFactory({
  client: 'pg',
  connection: {
    connectionString: env.DATABASE_URL,
    ssl: isLocalDatabase ? false : { rejectUnauthorized: false }
  },
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
