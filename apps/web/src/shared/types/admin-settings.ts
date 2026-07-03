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
  /** 全局日期时间显示格式（dayjs 模板） */
  dateTimeFormat?: string
  requireEmailVerification?: boolean
  loginLivenessLevel?: 'none' | 'silent' | 'action'
  enrollLivenessLevel?: 'none' | 'silent' | 'action'
  maxLoginAttempts: number
  /** 可写不回显 */
  defaultPassword?: string

  // ✅ 新增：验证码相关
  enableCaptcha: boolean
  captchaAfterFailedAttempts: number

  // ✅ 新增：强密码相关
  enableStrongPassword: boolean
  strongPasswordRules: StrongPasswordRules

  // ✅ 水印
  watermarkEnabled: boolean
  /** 服务端图片水印：uploads 图片出服务器前合成请求者身份，前端无法绕过 */
  watermarkServerEnabled: boolean
  watermarkScope: 'all' | 'exam'
  /** 内容模板：支持 {name} {email} {time} 占位符，| 分隔多行 */
  watermarkContent: string
  watermarkOpacity: number
  watermarkFontSize: number
  watermarkRotate: number
  watermarkGap: number
  watermarkColor: string

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
