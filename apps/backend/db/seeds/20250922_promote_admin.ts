import type { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  const hasUsers = await knex.schema.hasTable('users')
  const hasRoles = await knex.schema.hasTable('roles')
  if (!hasUsers || !hasRoles) return

  const email = process.env.ADMIN_EMAIL || 'admin@demo.com' // ← 改成你注册时用的邮箱更稳
  const user = await knex('users').where({ email }).first()
  if (!user) {
    console.warn('[seed:promote_admin] user not found:', email)
    return
  }

  if (await knex.schema.hasColumn('users', 'role')) {
    await knex('users').where({ email }).update({ role: 'admin', updated_at: knex.fn.now() })
  }

  // 确保 ADMIN 角色存在
  let role = await knex('roles').where({ code: 'ADMIN' }).first()
  if (!role) {
    const [id] = await knex('roles').insert({
      name: '管理员',
      code: 'ADMIN',
      description: '系统管理员',
      is_system: 1,
      is_disabled: 0,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    })
    role = { id }
  }

  const hasUserRoles = await knex.schema.hasTable('user_roles')
  const hasUserOrgRoles = await knex.schema.hasTable('user_org_roles')

  if (hasUserRoles) {
    const exists = await knex('user_roles').where({ user_id: user.id, role_id: role.id }).first()
    if (!exists) await knex('user_roles').insert({ user_id: user.id, role_id: role.id, created_at: knex.fn.now() })
  }

  if (hasUserOrgRoles) {
    const ORG_ID = 1
    const exists = await knex('user_org_roles').where({ user_id: user.id, org_id: ORG_ID, role_id: role.id }).first()
    if (!exists)
      await knex('user_org_roles').insert({
        user_id: user.id,
        org_id: ORG_ID,
        role_id: role.id,
        sort_order: 0,
        created_at: knex.fn.now(),
      })
  }

  console.log('[seed:promote_admin] promoted', email, 'to ADMIN')
}
