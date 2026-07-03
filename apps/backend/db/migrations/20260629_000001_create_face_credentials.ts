import type { Knex } from 'knex'

async function getUsersIdColumnType(knex: Knex) {
  const db = (knex.client.config as any).connection.database
  const [rows] = await knex.raw(
    `
    SELECT COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
    LIMIT 1
    `,
    [db]
  )
  const type = rows?.[0]?.COLUMN_TYPE as string | undefined
  if (!type) throw new Error('Cannot introspect users.id COLUMN_TYPE from information_schema')
  return type
}

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('face_credentials')) return

  const usersIdType = await getUsersIdColumnType(knex)

  // 一个用户可有多条（多角度样本）。登录时取该用户所有样本的最高相似度。
  // 只存特征向量（512 维 float32，JSON 数组），不存原始图像。
  await knex.schema.createTable('face_credentials', table => {
    table.bigIncrements('id').primary()
    table.specificType('user_id', usersIdType).notNullable()
    table.string('model', 32).notNullable().defaultTo('buffalo_l')
    table.smallint('dim').notNullable().defaultTo(512)
    table.json('embedding').notNullable() // float32[dim]，已 L2 归一化
    table.enu('source', ['self', 'admin']).notNullable().defaultTo('self') // 谁录入的
    table.specificType('created_by', usersIdType).nullable() // 管理员代录时记录操作者
    table.timestamp('consent_at').nullable() // 合规：本人同意时间
    table.string('consent_version', 32).nullable()
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    table.index(['user_id'], 'idx_face_cred_user')
    table.foreign('user_id', 'fk_face_cred_user').references('users.id').onDelete('CASCADE')
  })

  await knex.raw(
    `ALTER TABLE face_credentials MODIFY COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
  )
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('face_credentials')
}
