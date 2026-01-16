import type { Knex } from 'knex'

const STAT_TABLE = 'learning_statistics'
const TRACK_TABLE = 'learning_tracks'
const GOAL_TABLE = 'learning_goals'
const ACH_TABLE = 'learning_achievements'

export async function up(knex: Knex): Promise<void> {
  const hasStats = await knex.schema.hasTable(STAT_TABLE)
  if (!hasStats) {
    await knex.schema.createTable(STAT_TABLE, t => {
      t.bigIncrements('id').primary()
      t.bigInteger('user_id').unsigned().notNullable().comment('用户')
      t.bigInteger('subject_id').unsigned().nullable().comment('科目，可空')
      t.date('stat_date').notNullable().comment('统计日期')
      t.integer('total_study_time').notNullable().defaultTo(0).comment('学习时长(秒)')
      t.integer('total_questions').notNullable().defaultTo(0).comment('总做题数')
      t.integer('correct_questions').notNullable().defaultTo(0).comment('答对题数')
      t.decimal('accuracy_rate', 6, 2).notNullable().defaultTo(0).comment('正确率 0~100')
      t.integer('study_streak').notNullable().defaultTo(0).comment('连续学习天数')
      t.timestamps(true, true)

      t.index(['user_id', 'stat_date'], 'idx_lstat_user_date')
      t.index(['user_id', 'subject_id'], 'idx_lstat_user_subject')
    })
  }

  const hasTracks = await knex.schema.hasTable(TRACK_TABLE)
  if (!hasTracks) {
    await knex.schema.createTable(TRACK_TABLE, t => {
      t.bigIncrements('id').primary()
      t.bigInteger('user_id').unsigned().notNullable().comment('用户')
      t.string('activity_type', 50).notNullable().comment('活动类型')
      t.json('activity_data').nullable().comment('活动数据')
      t.bigInteger('subject_id').unsigned().nullable().comment('科目，可空')
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())

      t.index(['user_id', 'created_at'], 'idx_ltrack_user_time')
    })
  }

  const hasGoals = await knex.schema.hasTable(GOAL_TABLE)
  if (!hasGoals) {
    await knex.schema.createTable(GOAL_TABLE, t => {
      t.bigIncrements('id').primary()
      t.bigInteger('user_id').unsigned().notNullable().comment('用户')
      t.string('goal_type', 50).notNullable().comment('目标类型')
      t.integer('target_value').notNullable().comment('目标值')
      t.integer('current_value').notNullable().defaultTo(0).comment('当前值')
      t.date('start_date').notNullable().comment('开始日期')
      t.date('end_date').notNullable().comment('结束日期')
      t.string('status', 20).notNullable().defaultTo('in_progress').comment('状态')
      t.bigInteger('subject_id').unsigned().nullable().comment('科目，可空')
      t.text('description').nullable().comment('描述')
      t.timestamps(true, true)

      t.index(['user_id', 'status'], 'idx_lgoal_user_status')
    })
  }

  const hasAch = await knex.schema.hasTable(ACH_TABLE)
  if (!hasAch) {
    await knex.schema.createTable(ACH_TABLE, t => {
      t.bigIncrements('id').primary()
      t.bigInteger('user_id').unsigned().notNullable().comment('用户')
      t.string('achievement_type', 50).notNullable().comment('成就类型')
      t.string('achievement_name', 100).notNullable().comment('成就名称')
      t.text('achievement_description').notNullable().comment('成就描述')
      t.json('achievement_data').nullable().comment('成就数据')
      t.timestamp('unlocked_at').notNullable().defaultTo(knex.fn.now()).comment('解锁时间')

      t.index(['user_id', 'unlocked_at'], 'idx_lach_user_time')
    })
  }

  const hasNorm = await knex.schema.hasColumn(STAT_TABLE, 'subject_id_norm')
  if (!hasNorm && (await knex.schema.hasTable(STAT_TABLE))) {
    try {
      await knex.raw(
        `ALTER TABLE ${STAT_TABLE}
         ADD COLUMN subject_id_norm BIGINT GENERATED ALWAYS AS (IFNULL(subject_id,0)) STORED`
      )
      await knex.raw(
        `CREATE UNIQUE INDEX uq_lstat_user_subject_date
           ON ${STAT_TABLE} (user_id, subject_id_norm, stat_date)`
      )
    } catch {
      // ignore generated column failures
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  try {
    await knex.raw(`DROP INDEX uq_lstat_user_subject_date ON ${STAT_TABLE}`)
  } catch {}
  try {
    await knex.raw(`ALTER TABLE ${STAT_TABLE} DROP COLUMN subject_id_norm`)
  } catch {}
  await knex.schema.dropTableIfExists(ACH_TABLE)
  await knex.schema.dropTableIfExists(GOAL_TABLE)
  await knex.schema.dropTableIfExists(TRACK_TABLE)
  await knex.schema.dropTableIfExists(STAT_TABLE)
}
