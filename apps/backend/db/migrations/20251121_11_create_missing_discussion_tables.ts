import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // discussion_replies
  if (!(await knex.schema.hasTable('discussion_replies'))) {
    await knex.schema.createTable('discussion_replies', table => {
      table.bigIncrements('id').primary()
      table.bigInteger('discussion_id').unsigned().notNullable()
      table.bigInteger('user_id').unsigned().notNullable()
      table.bigInteger('parent_id').unsigned().nullable()
      table.text('content').notNullable()
      table.boolean('is_solution').notNullable().defaultTo(false)
      table.integer('like_count').notNullable().defaultTo(0)
      table.integer('reply_count').notNullable().defaultTo(0)
      table.timestamps(true, true)
      table.index(['discussion_id'], 'idx_discussion_replies_discussion')
      table.index(['parent_id'], 'idx_discussion_replies_parent')
    })
  }

  // discussion_view_locks
  if (!(await knex.schema.hasTable('discussion_view_locks'))) {
    await knex.schema.createTable('discussion_view_locks', table => {
      table.bigIncrements('id').primary()
      table.bigInteger('discussion_id').unsigned().notNullable()
      table.string('viewer_key', 191).notNullable()
      table.timestamp('expires_at').notNullable()
      table.unique(['discussion_id', 'viewer_key'], 'uq_discussion_view_lock')
      table.index(['expires_at'], 'idx_discussion_view_expire')
    })
  }

  // discussion_report table
  if (!(await knex.schema.hasTable('discussion_reports'))) {
    await knex.schema.createTable('discussion_reports', table => {
      table.bigIncrements('id').primary()
      table.bigInteger('user_id').unsigned().notNullable()
      table.enum('target_type', ['discussion', 'reply']).notNullable()
      table.bigInteger('target_id').unsigned().notNullable()
      table.string('reason', 255).notNullable()
      table.text('description').nullable()
      table.timestamps(true, true)
      table.unique(['user_id', 'target_type', 'target_id'], 'uq_report_user_target')
    })
  }

  // discussion_reports status helper
  if (!(await knex.schema.hasColumn('discussion_reports', 'status'))) {
    await knex.schema.alterTable('discussion_reports', table => {
      table.enum('status', ['pending', 'reviewed', 'dismissed']).notNullable().defaultTo('pending')
    })
  }

  // ensure discussion_likes table exists
  if (!(await knex.schema.hasTable('discussion_likes'))) {
    await knex.schema.createTable('discussion_likes', table => {
      table.bigIncrements('id').primary()
      table.bigInteger('user_id').unsigned().notNullable()
      table.enum('target_type', ['discussion', 'reply']).notNullable()
      table.bigInteger('target_id').unsigned().notNullable()
      table.timestamps(true, true)
      table.unique(['user_id', 'target_type', 'target_id'], 'uq_like_user_target')
      table.index(['target_type', 'target_id'], 'idx_like_target')
    })
  }

  // ensure discussion_bookmarks table exists
  if (!(await knex.schema.hasTable('discussion_bookmarks'))) {
    await knex.schema.createTable('discussion_bookmarks', table => {
      table.bigIncrements('id').primary()
      table.bigInteger('user_id').unsigned().notNullable()
      table.bigInteger('discussion_id').unsigned().notNullable()
      table.timestamps(true, true)
      table.unique(['user_id', 'discussion_id'], 'uq_bookmark_user_discussion')
      table.index(['discussion_id'], 'idx_bookmark_discussion')
    })
  }

  // ensure discussion_follows table exists
  if (!(await knex.schema.hasTable('discussion_follows'))) {
    await knex.schema.createTable('discussion_follows', table => {
      table.bigIncrements('id').primary()
      table.bigInteger('user_id').unsigned().notNullable()
      table.bigInteger('discussion_id').unsigned().notNullable()
      table.timestamps(true, true)
      table.unique(['user_id', 'discussion_id'], 'uq_follow_user_discussion')
      table.index(['discussion_id'], 'idx_follow_discussion')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('discussion_follows')
  await knex.schema.dropTableIfExists('discussion_bookmarks')
  await knex.schema.dropTableIfExists('discussion_likes')
  if (await knex.schema.hasColumn('discussion_reports', 'status')) {
    await knex.schema.alterTable('discussion_reports', table => table.dropColumn('status'))
  }
  await knex.schema.dropTableIfExists('discussion_reports')
  await knex.schema.dropTableIfExists('discussion_view_locks')
  await knex.schema.dropTableIfExists('discussion_replies')
}
