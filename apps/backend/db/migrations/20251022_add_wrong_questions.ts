// 20251022_add_wrong_questions.ts
import { Knex } from 'knex'

async function hasColumn(knex: Knex, table: string, col: string) {
  return knex.schema.hasColumn(table, col)
}

export async function up(knex: Knex): Promise<void> {
  const tableName = 'wrong_questions'

  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) {
    await knex.schema.createTable(tableName, t => {
      t.bigIncrements('id') // 主键

      // 注意：这里用了 BIGINT UNSIGNED。你的 users.id / questions.id 需与之匹配
      t.bigint('user_id').unsigned().notNullable()
      t.bigint('question_id').unsigned().notNullable()

      // 业务字段
      t.boolean('is_mastered').notNullable().defaultTo(0) // MySQL 实际为 tinyint(1)
      t.integer('wrong_count').notNullable().defaultTo(1)
      t.timestamp('first_wrong_at').nullable()
      t.timestamp('last_wrong_at').nullable()
      t.text('notes').nullable()

      // 约束与索引
      t.unique(['user_id', 'question_id'])
      t.index(['user_id', 'is_mastered'], 'idx_wrong_user_mastered')
      t.index(['question_id'], 'idx_wrong_question')

      t.timestamps(true, true)
    })

    // 可选：外键（只有当 users.id / questions.id 与上面 bigInt unsigned 完全一致时再加）
    try {
      await knex.schema.alterTable(tableName, t => {
        t.foreign('user_id', 'fk_wrong_user').references('id').inTable('users').onDelete('CASCADE')

        t.foreign('question_id', 'fk_wrong_question').references('id').inTable('questions').onDelete('CASCADE')
      })
    } catch (e) {
      // 若因“类型不兼容”失败，先跳过外键，仅保留索引，不影响功能
      console.warn('[warn] skip adding FKs on wrong_questions:', e)
    }
    return
  }

  // 表已存在：逐列补齐
  if (!(await hasColumn(knex, tableName, 'user_id'))) {
    await knex.schema.alterTable(tableName, t => {
      t.bigint('user_id').unsigned().notNullable()
    })
    await knex
      .raw('CREATE INDEX IF NOT EXISTS ?? ON ?? (??, ??)', [
        'idx_wrong_user_mastered',
        tableName,
        'user_id',
        'is_mastered',
      ])
      .catch(() => {}) // 兼容旧 MySQL：如果不支持 IF NOT EXISTS，可忽略报错
  }

  if (!(await hasColumn(knex, tableName, 'question_id'))) {
    await knex.schema.alterTable(tableName, t => {
      t.bigint('question_id').unsigned().notNullable()
    })
    await knex
      .raw('CREATE INDEX IF NOT EXISTS ?? ON ?? (??)', ['idx_wrong_question', tableName, 'question_id'])
      .catch(() => {})
  }

  if (!(await hasColumn(knex, tableName, 'is_mastered'))) {
    await knex.schema.alterTable(tableName, t => {
      t.boolean('is_mastered').notNullable().defaultTo(0)
    })
    await knex
      .raw('CREATE INDEX IF NOT EXISTS ?? ON ?? (??, ??)', [
        'idx_wrong_user_mastered',
        tableName,
        'user_id',
        'is_mastered',
      ])
      .catch(() => {})
  }

  if (!(await hasColumn(knex, tableName, 'wrong_count'))) {
    await knex.schema.alterTable(tableName, t => {
      t.integer('wrong_count').notNullable().defaultTo(1)
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const tableName = 'wrong_questions'
  if (await knex.schema.hasTable(tableName)) {
    // 先尝试去掉外键，避免某些数据库不能直接 drop 表
    try {
      await knex.schema.alterTable(tableName, t => {
        t.dropForeign(['user_id'], 'fk_wrong_user')
        t.dropForeign(['question_id'], 'fk_wrong_question')
      })
    } catch {}
    await knex.schema.dropTable(tableName)
  }
}
