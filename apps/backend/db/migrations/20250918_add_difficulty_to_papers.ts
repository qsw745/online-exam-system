// apps/backend/db/migrations/20250918_add_difficulty_to_papers.ts
import type { Knex } from 'knex'

type StatRow = { INDEX_NAME: string }

/** INFO_SCHEMA: 是否存在索引（类型安全写法） */
async function indexExists(knex: Knex, table: string, index: string): Promise<boolean> {
  const row = await knex<StatRow>('INFORMATION_SCHEMA.STATISTICS')
    .select('INDEX_NAME')
    .whereRaw('TABLE_SCHEMA = DATABASE()')
    .andWhere('TABLE_NAME', table)
    .andWhere('INDEX_NAME', index)
    .first()
  return !!row
}

/** 确保索引存在 */
async function ensureIndex(knex: Knex, table: string, indexName: string, cols: string[]) {
  if (!(await indexExists(knex, table, indexName))) {
    await knex.schema.alterTable(table, (t: Knex.TableBuilder) => {
      const colsRA: ReadonlyArray<string> = cols
      t.index(colsRA, indexName)
    })
  }
}

export async function up(knex: Knex): Promise<void> {
  const table = 'papers'

  // 1) 如果没有 difficulty 字段，则新增 ENUM('easy','medium','hard') NOT NULL DEFAULT 'medium'
  const hasDifficulty = await knex.schema.hasColumn(table, 'difficulty')
  if (!hasDifficulty) {
    await knex.schema.alterTable(table, (t: Knex.TableBuilder) => {
      t.enu('difficulty', ['easy', 'medium', 'hard']).notNullable().defaultTo('medium').comment('试卷难度')
    })
  }

  // 2) 索引：若有 created_at，就建 (difficulty, created_at)；否则建 (difficulty)
  const hasCreatedAt = await knex.schema.hasColumn(table, 'created_at')
  if (hasCreatedAt) {
    await ensureIndex(knex, table, 'idx_papers_difficulty_created_at', ['difficulty', 'created_at'])
  } else {
    await ensureIndex(knex, table, 'idx_papers_difficulty', ['difficulty'])
  }
}

export async function down(knex: Knex): Promise<void> {
  const table = 'papers'

  // 1) 尝试删除可能存在的两个索引（无则忽略）
  try {
    if (await indexExists(knex, table, 'idx_papers_difficulty_created_at')) {
      await knex.raw(`DROP INDEX idx_papers_difficulty_created_at ON \`${table}\``)
    }
  } catch {}
  try {
    if (await indexExists(knex, table, 'idx_papers_difficulty')) {
      await knex.raw(`DROP INDEX idx_papers_difficulty ON \`${table}\``)
    }
  } catch {}

  // 2) 删列（存在才删）
  const hasDifficulty = await knex.schema.hasColumn(table, 'difficulty')
  if (hasDifficulty) {
    await knex.schema.alterTable(table, (t: Knex.TableBuilder) => {
      t.dropColumn('difficulty')
    })
  }
}
