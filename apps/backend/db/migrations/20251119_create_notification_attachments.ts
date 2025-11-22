import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasAttachments = await knex.schema.hasTable('notification_attachments')
  if (!hasAttachments) {
    await knex.schema.createTable('notification_attachments', t => {
      t.increments('id').unsigned().primary()
      t.string('file_name', 255).notNullable()
      t.string('file_path', 500).notNullable()
      t.string('file_hash', 128).notNullable().unique()
      t.bigInteger('file_size').notNullable().defaultTo(0)
      t.string('mime_type', 255).nullable()
      t.string('url', 500).notNullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.index(['file_hash'], 'idx_notification_attach_hash')
    })
  }

  const hasColumn = await knex.schema.hasColumn('notifications', 'attachments')
  if (!hasColumn) {
    await knex.schema.alterTable('notifications', t => {
      t.json('attachments').nullable().comment('附件 JSON 列表')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('notifications', 'attachments')) {
    await knex.schema.alterTable('notifications', t => t.dropColumn('attachments'))
  }
  if (await knex.schema.hasTable('notification_attachments')) {
    await knex.schema.dropTable('notification_attachments')
  }
}
