import type { Knex } from 'knex'

const TBL = 'users'

export async function up(knex: Knex): Promise<void> {
  const hasPhone = await knex.schema.hasColumn(TBL, 'phone')
  const hasGender = await knex.schema.hasColumn(TBL, 'gender')
  const hasRemark = await knex.schema.hasColumn(TBL, 'remark')

  await knex.schema.alterTable(TBL, t => {
    if (!hasPhone) t.string('phone', 20).nullable().comment('手机号')
    // ⚠️ Knex: 使用 enu（不是 enum），默认值 '保密'
    if (!hasGender) t.enu('gender', ['男', '女', '保密']).notNullable().defaultTo('保密').comment('性别')
    if (!hasRemark) t.text('remark').nullable().comment('备注')
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasPhone = await knex.schema.hasColumn(TBL, 'phone')
  const hasGender = await knex.schema.hasColumn(TBL, 'gender')
  const hasRemark = await knex.schema.hasColumn(TBL, 'remark')

  await knex.schema.alterTable(TBL, t => {
    if (hasPhone) t.dropColumn('phone')
    if (hasGender) t.dropColumn('gender')
    if (hasRemark) t.dropColumn('remark')
  })
}
