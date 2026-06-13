import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasLastPracticedAt = await knex.schema.hasColumn('wrong_questions', 'last_practiced_at')
  const hasLastPracticeTime = await knex.schema.hasColumn('wrong_questions', 'last_practice_time')

  // 如果只有 last_practiced_at，就重命名为 last_practice_time，以匹配查询
  if (hasLastPracticedAt && !hasLastPracticeTime) {
    await knex.schema.alterTable('wrong_questions', t => {
      t.renameColumn('last_practiced_at', 'last_practice_time')
    })
  }

  // 如果两个都没有，就新增 last_practice_time
  if (!hasLastPracticedAt && !hasLastPracticeTime) {
    await knex.schema.alterTable('wrong_questions', t => {
      t.timestamp('last_practice_time').nullable().comment('最近练习时间')
    })
  }

  // 顺带统一 is_mastered 类型为 boolean（tinyint(1)）
  const hasIsMastered = await knex.schema.hasColumn('wrong_questions', 'is_mastered')
  if (!hasIsMastered) {
    await knex.schema.alterTable('wrong_questions', t => {
      t.boolean('is_mastered').notNullable().defaultTo(false)
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  // 不建议回滚名称变更，除非你确认调用侧已切回
}
