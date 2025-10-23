// migrations/20251021_add_user_profile_fields.ts
import type { Knex } from 'knex'

const TBL = 'users'

export async function up(knex: Knex): Promise<void> {
  // experience_points INT NOT NULL DEFAULT 0
  if (!(await knex.schema.hasColumn(TBL, 'experience_points'))) {
    await knex.schema.alterTable(TBL, t => {
      t.integer('experience_points').notNullable().defaultTo(0).comment('经验值/积分')
    })
  }

  // level INT NOT NULL DEFAULT 1
  if (!(await knex.schema.hasColumn(TBL, 'level'))) {
    await knex.schema.alterTable(TBL, t => {
      t.integer('level').notNullable().defaultTo(1).comment('等级')
    })
  }

  // avatar_url VARCHAR(255) NULL
  if (!(await knex.schema.hasColumn(TBL, 'avatar_url'))) {
    await knex.schema.alterTable(TBL, t => {
      t.string('avatar_url', 255).nullable().comment('头像 URL')
    })
  }

  // username 可选（任务查询里 GROUP_CONCAT 用到了 u.username）
  // 你现在把 email 当用户名也可以；但为了兼容 SQL，补一个可空字段。
  if (!(await knex.schema.hasColumn(TBL, 'username'))) {
    await knex.schema.alterTable(TBL, t => {
      t.string('username', 128).nullable().comment('可选的显示用户名')
      t.index(['username'], 'idx_users_username')
    })

    // 用 email 先回填一版，避免前端空白
    try {
      await knex.raw(`UPDATE ${TBL} SET username = COALESCE(username, email)`)
    } catch {}
  }

  // 保险：有些环境没 created_at/updated_at
  if (!(await knex.schema.hasColumn(TBL, 'created_at'))) {
    await knex.schema.alterTable(TBL, t => {
      t.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
    })
  }
  if (!(await knex.schema.hasColumn(TBL, 'updated_at'))) {
    await knex.schema.alterTable(TBL, t => {
      t.timestamp('updated_at', { useTz: false }).nullable()
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  // 回滚：按存在才删
  if (await knex.schema.hasColumn(TBL, 'username')) {
    await knex.schema.alterTable(TBL, t => {
      t.dropIndex(['username'], 'idx_users_username')
      t.dropColumn('username')
    })
  }
  if (await knex.schema.hasColumn(TBL, 'avatar_url')) {
    await knex.schema.alterTable(TBL, t => t.dropColumn('avatar_url'))
  }
  if (await knex.schema.hasColumn(TBL, 'level')) {
    await knex.schema.alterTable(TBL, t => t.dropColumn('level'))
  }
  if (await knex.schema.hasColumn(TBL, 'experience_points')) {
    await knex.schema.alterTable(TBL, t => t.dropColumn('experience_points'))
  }
  // created_at/updated_at 通常不建议删，这里就不动它们了
}
