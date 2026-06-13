import type { Knex } from 'knex'

const TABLE = 'files'

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable(TABLE)
  if (exists) return

  await knex.schema.createTable(TABLE, t => {
    t.increments('id').unsigned().primary()
    t.integer('parent_id').unsigned().nullable().index()
    t.enum('type', ['file', 'folder']).notNullable().defaultTo('file')
    t.string('name', 255).notNullable()
    t.string('original_name', 255).nullable()
    t.string('ext', 50).nullable()
    t.bigInteger('size').unsigned().nullable().defaultTo(0)
    t.string('mime_type', 255).nullable()
    t.string('storage_path', 500).nullable()
    t.string('download_url', 500).nullable()
    t.json('tags').nullable()
    t.text('description').nullable()
    t.string('version', 64).nullable()
    t.integer('created_by').unsigned().nullable()
    t.integer('updated_by').unsigned().nullable()
    t.boolean('is_deleted').notNullable().defaultTo(false).index()
    t.timestamp('deleted_at').nullable()
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
  })
}

export async function down(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable(TABLE)
  if (!exists) return
  await knex.schema.dropTable(TABLE)
}
