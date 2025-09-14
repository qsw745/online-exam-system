// features/admin-settings/types/index.ts
export interface SystemSettings {
  systemName: string
  allowUserRegistration: boolean
  maxLoginAttempts: number
  /** 仅写不读：页面可填写，接口 GET 不返回 */
  defaultPassword?: string
}
