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

    // 全局日期时间显示格式（dayjs 模板，如 YYYY-MM-DD HH:mm:ss），前端统一按此渲染
    dateTimeFormat?: string

    // 注册时是否需要邮箱验证（开启后新用户需点邮件链接激活才能登录）
    requireEmailVerification?: boolean

    // 场景活体等级：none=不检测 / silent=静默 / action=静默+动作(转头)
    loginLivenessLevel?: 'none' | 'silent' | 'action'
    enrollLivenessLevel?: 'none' | 'silent' | 'action'

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

    // === 水印 ===
    watermarkEnabled?: boolean              // 是否开启水印
    watermarkServerEnabled?: boolean        // 服务端图片水印（uploads 图片出服务器前合成请求者身份）
    watermarkScope?: 'all' | 'exam'         // 生效范围：全站 / 仅考试页
    watermarkContent?: string               // 内容模板，支持 {name} {email} {time} 占位符，| 分隔多行
    watermarkOpacity?: number               // 透明度 0.02~1
    watermarkFontSize?: number              // 字号 10~48
    watermarkRotate?: number                // 旋转角度 -90~90
    watermarkGap?: number                   // 水印块间距 20~400
    watermarkColor?: string                 // 颜色（#RRGGBB）

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
