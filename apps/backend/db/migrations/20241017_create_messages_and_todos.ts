
// apps/backend/src/database/migrations/20241017_create_messages_and_todos.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // messages
  const hasMessages = await knex.schema.hasTable('messages')
  if (!hasMessages) {
    await knex.schema.createTable('messages', (table) => {
      table.increments('id').primary()
      table.integer('user_id').notNullable()
      table.string('title', 255).notNullable()
      table.text('content')
      // MySQL 原生 ENUM；如果是其他数据库可改为 string + check 约束
      table
        .enu('type', ['info', 'warning', 'success', 'error'], {
          useNative: true,
          enumName: 'messages_type_enum', // MySQL 会忽略 enumName，Postgres 会使用
        })
        .notNullable()
        .defaultTo('info')
      table.boolean('is_read').notNullable().defaultTo(false)
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      table
        .timestamp('updated_at')
        .notNullable()
        .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))

      table.index(['user_id'])
      table.index(['user_id', 'is_read'])
    })
  }

  // todos
  const hasTodos = await knex.schema.hasTable('todos')
  if (!hasTodos) {
    await knex.schema.createTable('todos', (table) => {
      table.increments('id').primary()
      table.integer('user_id').notNullable()
      table.string('title', 255).notNullable()
      table.text('content')
      table.boolean('is_done').notNullable().defaultTo(false)
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      table
        .timestamp('updated_at')
        .notNullable()
        .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))

      table.index(['user_id'])
      table.index(['user_id', 'is_done'])
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  // 先删外键/索引（如有），再删表
  const hasTodos = await knex.schema.hasTable('todos')
  if (hasTodos) {
    await knex.schema.dropTable('todos')
  }

  const hasMessages = await knex.schema.hasTable('messages')
  if (hasMessages) {
    await knex.schema.dropTable('messages')
  }

  // 可选：Postgres 下删除 ENUM 类型
  // await knex.raw('DROP TYPE IF EXISTS messages_type_enum')
}
