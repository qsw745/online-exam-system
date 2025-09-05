// features/users/constants/index.ts
export const ROLE_LABEL: Record<string, string> = { admin: '管理员', teacher: '教师', student: '学生' }
export const ROLE_COLOR: Record<string, string> = { admin: 'red', teacher: 'blue', student: 'green' }
export const STATUS_LABEL: Record<'active' | 'disabled', string> = { active: '启用', disabled: '禁用' }
export const STATUS_COLOR: Record<'active' | 'disabled', 'green' | 'red'> = { active: 'green', disabled: 'red' }
