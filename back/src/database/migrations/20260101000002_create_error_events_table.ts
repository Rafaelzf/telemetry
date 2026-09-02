import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('error_events', (table) => {
    table.uuid('id').primary();
    table.string('app_id', 64).notNullable().references('id').inTable('applications');
    table.string('environment', 32).notNullable();
    table.string('release', 64);
    table.string('category', 32).notNullable();
    table.text('message').notNullable();
    table.text('stack_trace');
    table.text('source');
    table.text('url').notNullable();
    table.text('user_agent');
    table.timestamp('timestamp', { useTz: true }).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(
    'CREATE INDEX idx_errors_app_env ON error_events (app_id, environment, timestamp DESC)'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('error_events');
}
