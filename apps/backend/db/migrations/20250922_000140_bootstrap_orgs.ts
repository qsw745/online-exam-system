import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1) organizations
  if (!(await knex.schema.hasTable('organizations'))) {
    await knex.schema.createTable('organizations', t => {
      t.increments('id').unsigned().primary()
      t.integer('parent_id').unsigned().nullable().index()
      t.string('name', 200).notNullable()
      t.string('code', 100).notNullable() // 将加唯一索引
      t.integer('sort_order').nullable()
      t.boolean('is_disabled').notNullable().defaultTo(false)
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    })
  }
  // 确保 code 唯一
  try {
    await knex.schema.alterTable('organizations', t => {
      t.unique(['code'], { indexName: 'uk_organizations_code' })
    })
  } catch {
    /* 可能已存在 */
  }

  // 2) user_organizations（注册时 attachUserToOrg 会写）
  if (!(await knex.schema.hasTable('user_organizations'))) {
    await knex.schema.createTable('user_organizations', t => {
      t.increments('id').unsigned().primary()
      t.integer('user_id').unsigned().notNullable().index()
      t.integer('org_id').unsigned().notNullable().index()
      t.boolean('is_primary').notNullable().defaultTo(true)
      t.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now())
      t.unique(['user_id', 'org_id'], { indexName: 'uk_user_org' })
    })
  }

  // 3) org_default_roles（注册时获取组织默认角色会读）
  if (!(await knex.schema.hasTable('org_default_roles'))) {
    await knex.schema.createTable('org_default_roles', t => {
      t.increments('id').unsigned().primary()
      t.integer('org_id').unsigned().notNullable().index()
      t.integer('role_id').unsigned().notNullable().index()
      t.unique(['org_id', 'role_id'], { indexName: 'uk_org_role' })
    })
  }

  // 4) user_org_roles（注册时 ensureUserRoles 会写）
  if (!(await knex.schema.hasTable('user_org_roles'))) {
    await knex.schema.createTable('user_org_roles', t => {
      t.increments('id').unsigned().primary()
      t.integer('user_id').unsigned().notNullable().index()
      t.integer('org_id').unsigned().notNullable().index()
      t.integer('role_id').unsigned().notNullable().index()
      t.integer('sort_order').unsigned().nullable()
      t.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now())
      t.unique(['user_id', 'org_id', 'role_id'], { indexName: 'uk_user_org_role' })
    })
  }

  // 5) 确保存在默认机构（code='default'）
  const [existsDefaultOrg] = await knex('organizations').where({ code: 'default' }).limit(1)
  if (!existsDefaultOrg) {
    await knex('organizations').insert({
      name: '默认机构',
      code: 'default',
      is_disabled: 0,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    })
  }

  // 6) 确保存在“学生角色”（兼容大小写）
  const hasRoles = await knex.schema.hasTable('roles')
  let studentRoleId: number | null = null
  if (hasRoles) {
    const row = await knex('roles').whereRaw('LOWER(code)=LOWER(?)', ['STUDENT']).first()
    if (!row) {
      const [id] = await knex('roles').insert(
        {
          name: '学生',
          code: 'STUDENT',
          description: '学生角色',
          is_system: 0,
          is_disabled: 0,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now(),
        },
        ['id']
      )
      studentRoleId = typeof id === 'object' ? (id as any).id : (id as number)
    } else {
      studentRoleId = Number(row.id)
    }
  }

  // 7) 把“学生角色”设为默认机构的默认角色
  if (studentRoleId) {
    const defaultOrg = await knex('organizations').where({ code: 'default' }).first()
    if (defaultOrg) {
      const orgId = Number(defaultOrg.id)
      const exists = await knex('org_default_roles').where({ org_id: orgId, role_id: studentRoleId }).first()
      if (!exists) {
        await knex('org_default_roles').insert({ org_id: orgId, role_id: studentRoleId })
      }
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // 回滚时保持保守：只删除默认机构与默认绑定，不删表结构（避免影响其它数据）
  if (await knex.schema.hasTable('organizations')) {
    await knex('organizations').where({ code: 'default' }).del()
  }
  if (await knex.schema.hasTable('roles')) {
    // 不删除 STUDENT 角色（可能已有其它用户使用）
  }
  if (await knex.schema.hasTable('org_default_roles')) {
    const defOrg = await knex('organizations').where({ code: 'default' }).first()
    if (defOrg) {
      await knex('org_default_roles').where({ org_id: defOrg.id }).del()
    }
  }
  // 如需彻底回滚结构，可按需 drop 表，但一般不建议在生产库执行：
  // await knex.schema.dropTableIfExists('user_org_roles')
  // await knex.schema.dropTableIfExists('org_default_roles')
  // await knex.schema.dropTableIfExists('user_organizations')
  // await knex.schema.dropTableIfExists('organizations')
}
