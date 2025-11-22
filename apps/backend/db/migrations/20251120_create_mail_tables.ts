import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasMessages = await knex.schema.hasTable('mail_messages')
  if (!hasMessages) {
    await knex.schema.createTable('mail_messages', t => {
      t.increments('id').unsigned().primary()
      t.string('subject', 255).notNullable().defaultTo('')
      t.text('content', 'longtext').notNullable()
      t.integer('sender_id').unsigned().notNullable()
      t.enum('status', ['draft', 'sent']).notNullable().defaultTo('draft')
      t.json('recipients_snapshot').nullable()
      t.json('attachments').nullable()
      t.timestamp('sent_at').nullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      t.index(['sender_id', 'status'], 'idx_mail_sender_status')
      t.index(['sent_at'], 'idx_mail_sent_at')
    })
  }

  const hasRecipients = await knex.schema.hasTable('mail_recipients')
  if (!hasRecipients) {
    await knex.schema.createTable('mail_recipients', t => {
      t.increments('id').unsigned().primary()
      t.integer('message_id').unsigned().notNullable().references('id').inTable('mail_messages').onDelete('CASCADE')
      t.integer('recipient_id').unsigned().notNullable()
      t.boolean('is_read').notNullable().defaultTo(false)
      t.timestamp('read_at').nullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.index(['recipient_id', 'is_read'], 'idx_mail_recipient_read')
      t.index(['message_id', 'recipient_id'], 'idx_mail_message_recipient')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('mail_recipients')) {
    await knex.schema.dropTable('mail_recipients')
  }
  if (await knex.schema.hasTable('mail_messages')) {
    await knex.schema.dropTable('mail_messages')
  }
}
