import type { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  const hasUsers = await knex.schema.hasTable('users')
  const hasRoles = await knex.schema.hasTable('roles')
  if (!hasUsers || !hasRoles) return

  // 预置的 bcrypt 哈希（demo123456）
  const HASH = '$2b$10$CzKY36g1xwWlKkjG9fL/JupZ3peZxvE5zb1FTGMvOZGl7CQ4W8eXi'

  // 确保 users 有 password 列
  const hasPassword = await knex.schema.hasColumn('users', 'password')
  if (!hasPassword) {
    await knex.schema.alterTable('users', t => {
      t.string('password', 255).nullable().comment('bcrypt hash')
    })
  }

  // 1) 角色 upsert
  const roleRows = [
    { name: '管理员', code: 'ADMIN', description: '系统管理员', is_system: 1, is_disabled: 0 },
    { name: '教师', code: 'TEACHER', description: '教师角色', is_system: 0, is_disabled: 0 },
    { name: '学生', code: 'STUDENT', description: '学生角色', is_system: 0, is_disabled: 0 },
  ].map(r => ({ ...r, created_at: knex.fn.now(), updated_at: knex.fn.now() }))

  try {
    await knex('roles')
      .insert(roleRows)
      .onConflict('code')
      .merge(['name', 'description', 'is_system', 'is_disabled', 'updated_at'])
  } catch {}

  const roles = await knex('roles').whereIn('code', ['ADMIN', 'TEACHER', 'STUDENT'])
  const roleIdByCode = Object.fromEntries(roles.map((r: any) => [r.code, r.id]))

  // 2) 三个用户 upsert（只写 password）
  const base = (email: string, username: string) => ({
    username,
    email,
    is_disabled: 0,
    created_at: knex.fn.now(),
    updated_at: knex.fn.now(),
  })
  const rows = [
    { ...base('admin@demo.com', 'admin'), password: HASH },
    { ...base('teacher@demo.com', 'teacher'), password: HASH },
    { ...base('student@demo.com', 'student'), password: HASH },
  ]

  try {
    await knex('users').insert(rows).onConflict('email').merge(['password', 'is_disabled', 'updated_at'])
  } catch {
    await knex('users')
      .whereIn(
        'email',
        rows.map(r => r.email)
      )
      .del()
    await knex('users').insert(rows)
  }

  const users = await knex('users').whereIn(
    'email',
    rows.map(r => r.email)
  )
  const userIdByEmail = Object.fromEntries(users.map((u: any) => [u.email, u.id]))

  // 3) 绑定角色（存在哪个表就写哪个）
  const hasUserRoles = await knex.schema.hasTable('user_roles')
  const hasUserOrgRoles = await knex.schema.hasTable('user_org_roles')

  const pairs = [
    { email: 'admin@demo.com', code: 'ADMIN' },
    { email: 'teacher@demo.com', code: 'TEACHER' },
    { email: 'student@demo.com', code: 'STUDENT' },
  ]

  if (hasUserRoles) {
    for (const p of pairs) {
      const uid = userIdByEmail[p.email],
        rid = roleIdByCode[p.code]
      if (!uid || !rid) continue
      const exists = await knex('user_roles').where({ user_id: uid, role_id: rid }).first()
      if (!exists) await knex('user_roles').insert({ user_id: uid, role_id: rid, created_at: knex.fn.now() })
    }
  }

  if (hasUserOrgRoles) {
    const ORG_ID = 1
    for (const p of pairs) {
      const uid = userIdByEmail[p.email],
        rid = roleIdByCode[p.code]
      if (!uid || !rid) continue
      const exists = await knex('user_org_roles').where({ user_id: uid, org_id: ORG_ID, role_id: rid }).first()
      if (!exists)
        await knex('user_org_roles').insert({
          user_id: uid,
          org_id: ORG_ID,
          role_id: rid,
          sort_order: 0,
          created_at: knex.fn.now(),
        })
    }
  }

  console.log('[seed:demo_users] done')
}
