import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('questions')
  if (!hasTable) return

  const hasCol = await knex.schema.hasColumn('questions', 'difficulty')
  if (!hasCol) {
    // 采用常见的难度枚举；如果你项目里用的是别的取值，改成对应枚举即可
    await knex.schema.alterTable('questions', t => {
      t.enu('difficulty', ['easy', 'medium', 'hard']).notNullable().defaultTo('medium')
    })
  }
  // 不在这里建索引，避免与 wrong_questions_v2 重复；让它自己 add index
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('questions')
  if (!hasTable) return

  const hasCol = await knex.schema.hasColumn('questions', 'difficulty')
  if (hasCol) {
    // 若之后 wrong_questions_v2 已建过索引，先尝试删索引（忽略失败）
    try {
      // MySQL: DROP INDEX idx_name ON table
      await knex.raw('DROP INDEX `idx_questions_difficulty` ON `questions`')
    } catch {}
    await knex.schema.alterTable('questions', t => {
      t.dropColumn('difficulty')
    })
  }
}
