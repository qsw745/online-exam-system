import type { Knex } from 'knex'

const KEY = 'exam.anticheat.level'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('system_configs')
  if (!hasTable) return
  const exists = await knex('system_configs').where({ config_key: KEY }).first()
  if (!exists) {
    await knex('system_configs').insert({
      config_key: KEY,
      config_name: '考试防作弊等级',
      config_value: 'basic',
      value_type: 'select',
      enabled: true,
      description: 'none=关闭,basic=基础提醒,strict=严格(次数达到上限自动提交)',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('system_configs')
  if (!hasTable) return
  await knex('system_configs').where({ config_key: KEY }).delete()
}
