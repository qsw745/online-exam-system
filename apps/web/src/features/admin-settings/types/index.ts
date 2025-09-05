// features/admin-settings/types/index.ts
export interface SystemSettings {
  systemName: string
  allowUserRegistration: boolean
  maxLoginAttempts: number
  // ★ 默认密码建议“仅写不读”，表单内可选
  defaultPassword?: string
}
