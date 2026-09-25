const DEMO_USER_PASSWORD_HASH = '$2b$10$CzKY36g1xwWlKkjG9fL/JupZ3peZxvE5zb1FTGMvOZGl7CQ4W8eXi'

const DEMO_USERS = [
  {
    email: 'admin@demo.com',
    username: 'admin',
    role: 'admin',
    publicId: '00000000-0000-4000-8000-000000000001',
  },
  {
    email: 'teacher@demo.com',
    username: 'teacher',
    role: 'teacher',
    publicId: '00000000-0000-4000-8000-000000000002',
  },
  {
    email: 'student@demo.com',
    username: 'student',
    role: 'student',
    publicId: '00000000-0000-4000-8000-000000000003',
  },
] as const

export function buildDemoUserSeedRows(now: unknown, hasRole: boolean) {
  return DEMO_USERS.map(user => ({
    username: user.username,
    email: user.email,
    public_id: user.publicId,
    data_region: 'CN' as const,
    ...(hasRole ? { role: user.role } : {}),
    is_disabled: 0,
    password: DEMO_USER_PASSWORD_HASH,
    created_at: now,
    updated_at: now,
  }))
}
