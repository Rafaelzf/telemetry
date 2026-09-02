import knexFactory from 'knex';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

const command = process.argv[2] ?? 'latest';

const isLocalDatabase = /(localhost|127\.0\.0\.1)/.test(env.DATABASE_URL);

const knex = knexFactory({
  client: 'pg',
  connection: {
    connectionString: env.DATABASE_URL,
    ssl: isLocalDatabase ? false : { rejectUnauthorized: false }
  },
  migrations: {
    directory: fileURLToPath(new URL('./migrations', import.meta.url)),
    extension: 'ts',
    loadExtensions: ['.ts']
  }
});

async function run() {
  switch (command) {
    case 'latest': {
      const [, log] = await knex.migrate.latest();
      console.log(log.length ? `Applied migrations:\n${log.join('\n')}` : 'Already up to date.');
      break;
    }
    case 'rollback': {
      const [, log] = await knex.migrate.rollback();
      console.log(log.length ? `Rolled back migrations:\n${log.join('\n')}` : 'Nothing to roll back.');
      break;
    }
    case 'status': {
      const status = await knex.migrate.status();
      console.log(`Migration status: ${status}`);
      break;
    }
    default:
      throw new Error(`Unknown migrate command: ${command}`);
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await knex.destroy();
  });
