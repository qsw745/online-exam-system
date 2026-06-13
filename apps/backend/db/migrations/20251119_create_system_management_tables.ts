import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasDicts = await knex.schema.hasTable('dictionaries')
  if (!hasDicts) {
    await knex.schema.createTable('dictionaries', t => {
      t.increments('id').unsigned().primary()
      t.string('code', 100).notNullable().unique()
      t.string('name', 200).notNullable()
      t.text('description').nullable()
      t.boolean('enabled').notNullable().defaultTo(true)
      t.integer('sort_order').notNullable().defaultTo(0)
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    })
  }

  const hasDictItems = await knex.schema.hasTable('dictionary_items')
  if (!hasDictItems) {
    await knex.schema.createTable('dictionary_items', t => {
      t.increments('id').unsigned().primary()
      t.integer('dict_id').unsigned().notNullable().references('id').inTable('dictionaries').onDelete('CASCADE')
      t.string('label', 200).notNullable()
      t.string('value', 200).notNullable()
      t.string('tag', 100).nullable()
      t.boolean('enabled').notNullable().defaultTo(true)
      t.integer('sort_order').notNullable().defaultTo(0)
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    })
  }

  const hasConfigs = await knex.schema.hasTable('system_configs')
  if (!hasConfigs) {
    await knex.schema.createTable('system_configs', t => {
      t.increments('id').unsigned().primary()
      t.string('config_key', 150).notNullable().unique()
      t.string('config_name', 200).notNullable()
      t.text('config_value').nullable()
      t.string('value_type', 50).notNullable().defaultTo('text')
      t.boolean('enabled').notNullable().defaultTo(true)
      t.text('description').nullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    })
  }

  const hasJobs = await knex.schema.hasTable('scheduler_jobs')
  if (!hasJobs) {
    await knex.schema.createTable('scheduler_jobs', t => {
      t.increments('id').unsigned().primary()
      t.string('name', 200).notNullable()
      t.string('cron', 100).notNullable()
      t.string('handler', 200).notNullable()
      t.string('status', 50).notNullable().defaultTo('paused')
      t.timestamp('last_run_at').nullable()
      t.timestamp('next_run_at').nullable()
      t.text('description').nullable()
      t.json('meta').nullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    })
  }

  const hasIntegrations = await knex.schema.hasTable('integrations')
  if (!hasIntegrations) {
    await knex.schema.createTable('integrations', t => {
      t.increments('id').unsigned().primary()
      t.string('name', 200).notNullable()
      t.string('type', 50).notNullable()
      t.text('endpoint').nullable()
      t.json('config').nullable()
      t.boolean('enabled').notNullable().defaultTo(true)
      t.text('description').nullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('integrations')) {
    await knex.schema.dropTable('integrations')
  }
  if (await knex.schema.hasTable('scheduler_jobs')) {
    await knex.schema.dropTable('scheduler_jobs')
  }
  if (await knex.schema.hasTable('system_configs')) {
    await knex.schema.dropTable('system_configs')
  }
  if (await knex.schema.hasTable('dictionary_items')) {
    await knex.schema.dropTable('dictionary_items')
  }
  if (await knex.schema.hasTable('dictionaries')) {
    await knex.schema.dropTable('dictionaries')
  }
}
