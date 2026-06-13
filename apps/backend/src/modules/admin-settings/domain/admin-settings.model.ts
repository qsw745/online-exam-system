// apps/backend/src/modules/admin-settings/domain/admin-settings.model.ts
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

    // === 新增：验证码/强密码 ===
    enableCaptcha?: boolean                 // 是否启用验证码
    captchaAfterFailed?: number             // 密码输错 >= N 次后强制出验证码（0 表示每次都要）
    enableStrongPassword?: boolean          // 启用强密码
    // 规则二选一：正则优先；否则按下方开关生成规则
    strongPasswordRegex?: string            // 可由管理员自定义
    strongPasswordMinLength?: number        // 默认 8
    strongPasswordRequireUpper?: boolean    // 要求大写
    strongPasswordRequireLower?: boolean    // 要求小写
    strongPasswordRequireDigit?: boolean    // 要求数字
    strongPasswordRequireSpecial?: boolean  // 要求特殊字符

    // === AI 大模型配置 ===
    aiEnabled?: boolean
    aiProvider?: 'deepseek' | 'openai' | 'custom' | 'local'
    aiBaseUrl?: string
    aiApiKey?: string
    aiApiKeySet?: boolean
    aiModel?: string
    aiAllowedModels?: string
    aiTemperature?: number
    aiMaxTokens?: number
    aiTimeoutMs?: number
    aiThinkingMode?: 'enabled' | 'disabled'
}
