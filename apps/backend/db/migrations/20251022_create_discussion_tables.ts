import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1) 分类表
  const hasCategories = await knex.schema.hasTable('discussion_categories')
  if (!hasCategories) {
    await knex.schema.createTable('discussion_categories', t => {
      t.bigIncrements('id').primary()
      t.string('name', 100).notNullable()
      t.string('slug', 120).nullable().unique()
      t.string('color', 32).nullable()
      t.boolean('is_active').notNullable().defaultTo(true)
      t.integer('sort_order').notNullable().defaultTo(100)
      t.timestamps(true, true)
      t.index(['is_active', 'sort_order'], 'idx_dc_active_sort')
    })

    // 可选：初始化几条分类，避免前端空态
    await knex('discussion_categories').insert([
      { name: '综合讨论', color: '#4096ff', is_active: 1, sort_order: 10 },
      { name: '学习经验', color: '#52c41a', is_active: 1, sort_order: 20 },
      { name: '题目求助', color: '#faad14', is_active: 1, sort_order: 30 },
    ])
  }

  // 2) 讨论主表
  const hasDiscussions = await knex.schema.hasTable('discussions')
  if (!hasDiscussions) {
    await knex.schema.createTable('discussions', t => {
      t.bigIncrements('id').primary()
      t.bigInteger('user_id').unsigned().notNullable()
      t.bigInteger('category_id').unsigned().nullable()
      t.string('title', 200).notNullable()
      t.text('content').notNullable()
      t.boolean('is_pinned').notNullable().defaultTo(false)
      t.timestamp('last_reply_at').nullable()
      t.integer('reply_count').notNullable().defaultTo(0)
      t.integer('view_count').notNullable().defaultTo(0)
      t.timestamps(true, true)

      // 索引
      t.index(['is_pinned', 'last_reply_at', 'created_at'], 'idx_discuss_sort')
      t.index(['category_id'], 'idx_discuss_category')
      t.index(['user_id'], 'idx_discuss_user')

      // 如需外键再放开（确保被引用表存在且引擎为 InnoDB）
      // t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE')
      // t.foreign('category_id').references('id').inTable('discussion_categories').onDelete('SET NULL')
    })
  }

  // 3) 点赞表（多 target 设计：discussion / reply 等）
  const hasLikes = await knex.schema.hasTable('discussion_likes')
  if (!hasLikes) {
    await knex.schema.createTable('discussion_likes', t => {
      t.bigIncrements('id').primary()
      t.bigInteger('user_id').unsigned().notNullable()
      t.enum('target_type', ['discussion', 'reply']).notNullable()
      t.bigInteger('target_id').unsigned().notNullable()
      t.timestamps(true, true)

      t.unique(['user_id', 'target_type', 'target_id'], { indexName: 'uq_like_user_target' })
      t.index(['target_type', 'target_id'], 'idx_like_target')
      t.index(['user_id'], 'idx_like_user')
    })
  }

  // 4) 收藏表（仅 discussion）
  const hasBookmarks = await knex.schema.hasTable('discussion_bookmarks')
  if (!hasBookmarks) {
    await knex.schema.createTable('discussion_bookmarks', t => {
      t.bigIncrements('id').primary()
      t.bigInteger('user_id').unsigned().notNullable()
      t.bigInteger('discussion_id').unsigned().notNullable()
      t.timestamps(true, true)

      t.unique(['user_id', 'discussion_id'], { indexName: 'uq_bookmark_user_discussion' })
      t.index(['discussion_id'], 'idx_bookmark_discussion')
      t.index(['user_id'], 'idx_bookmark_user')
      // t.foreign('discussion_id').references('id').inTable('discussions').onDelete('CASCADE')
    })
  }

  // 5) 关注表（仅 discussion）
  const hasFollows = await knex.schema.hasTable('discussion_follows')
  if (!hasFollows) {
    await knex.schema.createTable('discussion_follows', t => {
      t.bigIncrements('id').primary()
      t.bigInteger('user_id').unsigned().notNullable()
      t.bigInteger('discussion_id').unsigned().notNullable()
      t.timestamps(true, true)

      t.unique(['user_id', 'discussion_id'], { indexName: 'uq_follow_user_discussion' })
      t.index(['discussion_id'], 'idx_follow_discussion')
      t.index(['user_id'], 'idx_follow_user')
      // t.foreign('discussion_id').references('id').inTable('discussions').onDelete('CASCADE')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  // 按依赖顺序删除
  await knex.schema.dropTableIfExists('discussion_follows')
  await knex.schema.dropTableIfExists('discussion_bookmarks')
  await knex.schema.dropTableIfExists('discussion_likes')
  await knex.schema.dropTableIfExists('discussions')
  await knex.schema.dropTableIfExists('discussion_categories')
}
