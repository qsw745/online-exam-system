import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('user_organizations')) || !(await knex.schema.hasTable('user_org_roles'))) return

  await knex.raw(`
    INSERT IGNORE INTO user_organizations (user_id, org_id, is_primary, assigned_at)
    SELECT picked.user_id, picked.org_id, 1, NOW()
      FROM (
        SELECT user_id, MIN(org_id) AS org_id
          FROM user_org_roles
         GROUP BY user_id
      ) picked
      LEFT JOIN user_organizations uo ON uo.user_id = picked.user_id
     WHERE uo.user_id IS NULL
  `)
}

export async function down(_knex: Knex): Promise<void> {
  // 数据补齐不回滚，避免删除真实用户组织归属。
}
