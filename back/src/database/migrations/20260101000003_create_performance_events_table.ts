import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('performance_events', (table) => {
    table.uuid('id').primary();
    table.string('app_id', 64).notNullable().references('id').inTable('applications');
    table.string('environment', 32).notNullable();
    table.string('metric_name', 32).notNullable();
    table.decimal('metric_value', 10, 4).notNullable();
    table.text('url').notNullable();
    table.timestamp('timestamp', { useTz: true }).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(
    'CREATE INDEX idx_perf_app_metric ON performance_events (app_id, metric_name, timestamp DESC)'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('performance_events');
}
