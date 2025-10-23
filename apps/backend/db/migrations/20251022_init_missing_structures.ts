// apps/backend/migrations/20251022_init_missing_structures.ts
import type { Knex } from 'knex'

// 小工具：条件加列 / 删列
async function addColumnIfMissing(
  knex: Knex,
  tableName: string,
  column: string,
  add: (tb: Knex.CreateTableBuilder | Knex.AlterTableBuilder) => void
) {
  const exists = await knex.schema.hasColumn(tableName, column)
  if (!exists) {
    await knex.schema.alterTable(tableName, add)
  }
}

async function dropColumnIfExists(knex: Knex, tableName: string, column: string) {
  const exists = await knex.schema.hasColumn(tableName, column)
  if (exists) {
    await knex.schema.alterTable(tableName, tb => {
      tb.dropColumn(column)
    })
  }
}

export async function up(knex: Knex): Promise<void> {
  // 1) user_settings
  const hasUserSettings = await knex.schema.hasTable('user_settings')
  if (!hasUserSettings) {
    await knex.schema.createTable('user_settings', tb => {
      tb.bigInteger('user_id').unsigned().notNullable().primary()
      // MySQL JSON
      tb.specificType('settings', 'JSON').notNullable()
      tb.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      // ON UPDATE 需要 raw
      tb.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      tb.foreign('user_id').references('users.id').onDelete('CASCADE')
    })
    // 设置表选项（可选）：引擎/字符集
    await knex.raw(`ALTER TABLE user_settings ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
    // 为 updated_at 增加 ON UPDATE CURRENT_TIMESTAMP
    await knex.raw(
      `ALTER TABLE user_settings MODIFY COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
    )
  }

  // 2) unit_menus 缺列补齐
  const unitMenusExists = await knex.schema.hasTable('unit_menus')
  if (unitMenusExists) {
    await addColumnIfMissing(knex, 'unit_menus', 'is_hidden', tb => {
      ;(tb as Knex.AlterTableBuilder).tinyint?.('is_hidden', 1).notNullable().defaultTo(0) ||
        (tb as Knex.AlterTableBuilder).boolean('is_hidden').notNullable().defaultTo(0)
    })
    await addColumnIfMissing(knex, 'unit_menus', 'is_disabled', tb => {
      ;(tb as Knex.AlterTableBuilder).tinyint?.('is_disabled', 1).notNullable().defaultTo(0) ||
        (tb as Knex.AlterTableBuilder).boolean('is_disabled').notNullable().defaultTo(0)
    })
    await addColumnIfMissing(knex, 'unit_menus', 'menu_type', tb => {
      ;(tb as Knex.AlterTableBuilder).string('menu_type', 32).nullable()
    })
    await addColumnIfMissing(knex, 'unit_menus', 'permission_code', tb => {
      ;(tb as Knex.AlterTableBuilder).string('permission_code', 100).nullable()
    })
    await addColumnIfMissing(knex, 'unit_menus', 'redirect', tb => {
      ;(tb as Knex.AlterTableBuilder).string('redirect', 255).nullable()
    })
    await addColumnIfMissing(knex, 'unit_menus', 'meta', tb => {
      ;(tb as Knex.AlterTableBuilder).specificType('meta', 'JSON').nullable()
    })
    await addColumnIfMissing(knex, 'unit_menus', 'parent_sys_id', tb => {
      ;(tb as Knex.AlterTableBuilder).bigInteger('parent_sys_id').unsigned().nullable()
    })
    await addColumnIfMissing(knex, 'unit_menus', 'sort_order', tb => {
      ;(tb as Knex.AlterTableBuilder).integer('sort_order').nullable()
    })
  }

  // 3) questions.tags（JSON）
  const hasQuestions = await knex.schema.hasTable('questions')
  if (hasQuestions) {
    const hasTags = await knex.schema.hasColumn('questions', 'tags')
    if (!hasTags) {
      await knex.schema.alterTable('questions', tb => {
        tb.specificType('tags', 'JSON').nullable()
      })
      await knex.raw(`ALTER TABLE questions MODIFY COLUMN tags JSON NULL`)
    }

    // （可选）回填：若存在 question_tags(question_id, tag)
    const hasQuestionTags = await knex.schema.hasTable('question_tags')
    if (hasQuestionTags) {
      // 注意：JSON_ARRAYAGG 需 MySQL 5.7+；这段是幂等的，会覆盖为当前聚合结果
      await knex.raw(`
        UPDATE questions q
        JOIN (
          SELECT question_id, JSON_ARRAYAGG(tag) AS tags_json
          FROM question_tags
          GROUP BY question_id
        ) t ON t.question_id = q.id
        SET q.tags = t.tags_json
      `)
    }
  }

  // 4) 收藏夹相关表：favorite_categories / favorites / favorite_items
  const hasFavCat = await knex.schema.hasTable('favorite_categories')
  if (!hasFavCat) {
    await knex.schema.createTable('favorite_categories', tb => {
      tb.bigIncrements('id').primary()
      tb.bigInteger('user_id').unsigned().notNullable().index('idx_fc_user')
      tb.string('name', 64).notNullable()
      tb.string('color', 16).nullable()
      tb.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      tb.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      tb.foreign('user_id').references('users.id').onDelete('CASCADE')
    })
    await knex.raw(`ALTER TABLE favorite_categories ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
    await knex.raw(
      `ALTER TABLE favorite_categories MODIFY COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
    )
  }

  const hasFavorites = await knex.schema.hasTable('favorites')
  if (!hasFavorites) {
    await knex.schema.createTable('favorites', tb => {
      tb.bigIncrements('id').primary()
      tb.bigInteger('user_id').unsigned().notNullable().index('idx_fav_user')
      tb.string('title', 255).notNullable()
      tb.text('description').nullable()
      tb.bigInteger('category_id').unsigned().nullable().index('idx_fav_cat')
      tb.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      tb.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      tb.foreign('user_id').references('users.id').onDelete('CASCADE')
      tb.foreign('category_id').references('favorite_categories.id').onDelete('SET NULL')
    })
    await knex.raw(`ALTER TABLE favorites ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
    await knex.raw(
      `ALTER TABLE favorites MODIFY COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
    )
  }

  const hasFavoriteItems = await knex.schema.hasTable('favorite_items')
  if (!hasFavoriteItems) {
    await knex.schema.createTable('favorite_items', tb => {
      tb.bigIncrements('id').primary()
      tb.bigInteger('favorite_id').unsigned().notNullable().index('idx_fi_fav')
      tb.string('entity_type', 32).notNullable()
      tb.bigInteger('entity_id').unsigned().notNullable()
      tb.specificType('extra', 'JSON').nullable()
      tb.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      tb.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      tb.index(['entity_type', 'entity_id'], 'idx_fi_entity')
      tb.foreign('favorite_id').references('favorites.id').onDelete('CASCADE')
    })
    await knex.raw(`ALTER TABLE favorite_items ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
    await knex.raw(
      `ALTER TABLE favorite_items MODIFY COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
    )
  }
}

export async function down(knex: Knex): Promise<void> {
  // 回滚顺序需要考虑外键
  // 4) 收藏夹
  if (await knex.schema.hasTable('favorite_items')) {
    await knex.schema.dropTable('favorite_items')
  }
  if (await knex.schema.hasTable('favorites')) {
    await knex.schema.dropTable('favorites')
  }
  if (await knex.schema.hasTable('favorite_categories')) {
    await knex.schema.dropTable('favorite_categories')
  }

  // 3) questions.tags
  const hasQuestions = await knex.schema.hasTable('questions')
  if (hasQuestions) {
    await dropColumnIfExists(knex, 'questions', 'tags')
  }

  // 2) unit_menus 补的列回滚（仅删除我们加的列）
  const unitMenusExists = await knex.schema.hasTable('unit_menus')
  if (unitMenusExists) {
    await dropColumnIfExists(knex, 'unit_menus', 'is_hidden')
    await dropColumnIfExists(knex, 'unit_menus', 'is_disabled')
    await dropColumnIfExists(knex, 'unit_menus', 'menu_type')
    await dropColumnIfExists(knex, 'unit_menus', 'permission_code')
    await dropColumnIfExists(knex, 'unit_menus', 'redirect')
    await dropColumnIfExists(knex, 'unit_menus', 'meta')
    await dropColumnIfExists(knex, 'unit_menus', 'parent_sys_id')
    await dropColumnIfExists(knex, 'unit_menus', 'sort_order')
  }

  // 1) user_settings
  if (await knex.schema.hasTable('user_settings')) {
    await knex.schema.dropTable('user_settings')
  }
}
