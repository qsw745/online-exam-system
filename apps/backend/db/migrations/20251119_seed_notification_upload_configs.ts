import type { Knex } from 'knex'

const SIZE_KEY = 'notify.attach.maxSizeMB'
const TYPES_KEY = 'notify.attach.allowedTypes'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('system_configs')
  if (!hasTable) return

  const sizeExists = await knex('system_configs').where({ config_key: SIZE_KEY }).first()
  if (!sizeExists) {
    await knex('system_configs').insert({
      config_key: SIZE_KEY,
      config_name: '通知附件最大大小(MB)',
      config_value: '20',
      value_type: 'number',
      enabled: true,
      description: '控制通知附件上传的单文件大小(MB)',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    })
  }

  const typesExists = await knex('system_configs').where({ config_key: TYPES_KEY }).first()
  if (!typesExists) {
    await knex('system_configs').insert({
      config_key: TYPES_KEY,
      config_name: '通知附件允许的后缀',
      config_value: 'pdf,doc,docx,xls,xlsx,ppt,pptx,zip,png,jpg,jpeg',
      value_type: 'text',
      enabled: true,
      description: '逗号分隔的扩展名列表',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('system_configs')
  if (!hasTable) return
  await knex('system_configs').whereIn('config_key', [SIZE_KEY, TYPES_KEY]).delete()
}
