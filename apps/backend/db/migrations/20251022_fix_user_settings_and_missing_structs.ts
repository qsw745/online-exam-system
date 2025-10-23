import type { Knex } from 'knex'

async function getUsersIdColumnType(knex: Knex) {
  const db = (knex.client.config as any).connection.database
  const [rows] = await knex.raw(
    `
    SELECT COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
    LIMIT 1
    `,
    [db]
  )
  const t = rows?.[0]?.COLUMN_TYPE as string | undefined
  if (!t) throw new Error('Cannot introspect users.id COLUMN_TYPE from information_schema')
  // 例如 'int(11) unsigned' / 'bigint(20) unsigned'
  return t
}

async function hasColumn(knex: Knex, table: string, col: string) {
  return knex.schema.hasColumn(table, col)
}

export async function up(knex: Knex): Promise<void> {
  const usersIdColType = await getUsersIdColumnType(knex)
  const db = (knex.client.config as any).connection.database

  // --- user_settings ---
  if (!(await knex.schema.hasTable('user_settings'))) {
    await knex.schema.createTable('user_settings', tb => {
      tb.specificType('user_id', usersIdColType).notNullable()
      tb.specificType('settings', 'JSON').notNullable()
      tb.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      tb.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      tb.primary(['user_id'])
      tb.index(['user_id'], 'idx_user_settings_user_id')
    })
    await knex.raw(
      `ALTER TABLE user_settings MODIFY COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
    )
  } else {
    // 若已存在，确保列类型对齐
    await knex.raw(`ALTER TABLE user_settings MODIFY COLUMN user_id ${usersIdColType} NOT NULL`)
  }
  // 重建外键（幂等处理）
  const [fkRows] = await knex.raw(
    `
    SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_settings' AND COLUMN_NAME = 'user_id' AND REFERENCED_TABLE_NAME IS NOT NULL
    `,
    [db]
  )
  for (const r of fkRows || []) {
    await knex.raw(`ALTER TABLE user_settings DROP FOREIGN KEY \`${r.CONSTRAINT_NAME}\``)
  }
  await knex.schema.alterTable('user_settings', tb => {
    tb.foreign('user_id', 'user_settings_user_id_foreign').references('users.id').onDelete('CASCADE')
  })

 
  // --- unit_menus 缺列 ---
  if (await knex.schema.hasTable('unit_menus')) {
    const addCol = async (col: string, typeDDL: string) => {
      if (!(await hasColumn(knex, 'unit_menus', col))) {
        await knex.raw(`ALTER TABLE \`unit_menus\` ADD COLUMN \`${col}\` ${typeDDL}`)
      }
    }

    await addCol('is_hidden', 'TINYINT(1) NOT NULL DEFAULT 0')
    await addCol('is_disabled', 'TINYINT(1) NOT NULL DEFAULT 0')
    await addCol('menu_type', 'VARCHAR(32) NULL')
    await addCol('permission_code', 'VARCHAR(100) NULL')
    await addCol('redirect', 'VARCHAR(255) NULL')
    await addCol('meta', 'JSON NULL')
    await addCol('parent_sys_id', 'BIGINT UNSIGNED NULL')
    await addCol('sort_order', 'INT NULL')
  }

  // --- questions.tags ---
  if (await knex.schema.hasTable('questions')) {
    if (!(await hasColumn(knex, 'questions', 'tags'))) {
      await knex.raw(`ALTER TABLE questions ADD COLUMN tags JSON NULL`)
    }
    // 可选：若存在 question_tags 则回填到 JSON
    const [qt] = await knex.raw(
      `
      SELECT 1 AS x FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'question_tags' LIMIT 1
      `,
      [db]
    )
    if (qt.length) {
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

  // --- favorites 相关（user_id 与 users.id 完全对齐）---
  if (!(await knex.schema.hasTable('favorite_categories'))) {
    await knex.schema.createTable('favorite_categories', tb => {
      tb.bigIncrements('id').primary()
      tb.specificType('user_id', usersIdColType).notNullable().index('idx_fc_user')
      tb.string('name', 64).notNullable()
      tb.string('color', 16).nullable()
      tb.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      tb.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      tb.foreign('user_id').references('users.id').onDelete('CASCADE')
    })
    await knex.raw(
      `ALTER TABLE favorite_categories MODIFY COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
    )
  }

  if (!(await knex.schema.hasTable('favorites'))) {
    await knex.schema.createTable('favorites', tb => {
      tb.bigIncrements('id').primary()
      tb.specificType('user_id', usersIdColType).notNullable().index('idx_fav_user')
      tb.string('title', 255).notNullable()
      tb.text('description').nullable()
      tb.bigInteger('category_id').unsigned().nullable().index('idx_fav_cat')
      tb.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      tb.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      tb.foreign('user_id').references('users.id').onDelete('CASCADE')
      tb.foreign('category_id').references('favorite_categories.id').onDelete('SET NULL')
    })
    await knex.raw(
      `ALTER TABLE favorites MODIFY COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
    )
  }

  if (!(await knex.schema.hasTable('favorite_items'))) {
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
    await knex.raw(
      `ALTER TABLE favorite_items MODIFY COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
    )
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('favorite_items')) await knex.schema.dropTable('favorite_items')
  if (await knex.schema.hasTable('favorites')) await knex.schema.dropTable('favorites')
  if (await knex.schema.hasTable('favorite_categories')) await knex.schema.dropTable('favorite_categories')

  if (await knex.schema.hasTable('questions')) {
    if (await knex.schema.hasColumn('questions', 'tags')) {
      await knex.schema.alterTable('questions', tb => tb.dropColumn('tags'))
    }
  }

  if (await knex.schema.hasTable('unit_menus')) {
    const drop = async (col: string) => {
      if (await knex.schema.hasColumn('unit_menus', col)) {
        await knex.schema.alterTable('unit_menus', tb => {
          tb.dropColumn(col)
        })
      }
    }
    await drop('is_hidden')
    await drop('is_disabled')
    await drop('menu_type')
    await drop('permission_code')
    await drop('redirect')
    await drop('meta')
    await drop('parent_sys_id')
    await drop('sort_order')
  }

  if (await knex.schema.hasTable('user_settings')) {
    await knex.schema.dropTable('user_settings')
  }
}
