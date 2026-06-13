// apps/web/src/shared/types/admin-settings.ts
export interface StrongPasswordRules {
  minLength: number
  requireUpper: boolean
  requireLower: boolean
  requireNumber: boolean
  requireSymbol: boolean
  forbidRepeated: boolean
  forbidCommon: boolean
}

export interface SystemSettings {
  systemName: string
  allowUserRegistration: boolean
  maxLoginAttempts: number
  /** 可写不回显 */
  defaultPassword?: string

  // ✅ 新增：验证码相关
  enableCaptcha: boolean
  captchaAfterFailedAttempts: number

  // ✅ 新增：强密码相关
  enableStrongPassword: boolean
  strongPasswordRules: StrongPasswordRules

  aiEnabled: boolean
  aiProvider: 'deepseek' | 'openai' | 'custom' | 'local'
  aiBaseUrl: string
  /** 可写不回显 */
  aiApiKey?: string
  aiApiKeySet?: boolean
  aiModel: string
  aiAllowedModels: string
  aiTemperature: number
  aiMaxTokens: number
  aiTimeoutMs: number
  aiThinkingMode: 'enabled' | 'disabled'
}
