import knexFactory from 'knex';
import { env } from '../config/env.js';

const command = process.argv[2] ?? 'latest';

const knex = knexFactory({
  client: 'pg',
  connection: env.DATABASE_URL,
  migrations: {
    directory: './migrations',
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
