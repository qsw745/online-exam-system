import type { Knex } from 'knex'

const TABLE = 'users'

export async function up(knex: Knex): Promise<void> {
  // 分开写，配合 hasColumn 做幂等检查（MySQL 5.x 无 IF NOT EXISTS）
  if (!(await knex.schema.hasColumn(TABLE, 'phone'))) {
    await knex.schema.alterTable(TABLE, t => {
      t.string('phone', 32).nullable().comment('联系电话')
    })
  }
  if (!(await knex.schema.hasColumn(TABLE, 'bio'))) {
    await knex.schema.alterTable(TABLE, t => {
      t.text('bio').nullable().comment('个人介绍')
    })
  }
  if (!(await knex.schema.hasColumn(TABLE, 'school'))) {
    await knex.schema.alterTable(TABLE, t => {
      t.string('school', 100).nullable().comment('学校')
    })
  }
  if (!(await knex.schema.hasColumn(TABLE, 'class_name'))) {
    await knex.schema.alterTable(TABLE, t => {
      t.string('class_name', 100).nullable().comment('班级')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn(TABLE, 'class_name')) {
    await knex.schema.alterTable(TABLE, t => {
      t.dropColumn('class_name')
    })
  }
  if (await knex.schema.hasColumn(TABLE, 'school')) {
    await knex.schema.alterTable(TABLE, t => {
      t.dropColumn('school')
    })
  }
  if (await knex.schema.hasColumn(TABLE, 'bio')) {
    await knex.schema.alterTable(TABLE, t => {
      t.dropColumn('bio')
    })
  }
  if (await knex.schema.hasColumn(TABLE, 'phone')) {
    await knex.schema.alterTable(TABLE, t => {
      t.dropColumn('phone')
    })
  }
}
