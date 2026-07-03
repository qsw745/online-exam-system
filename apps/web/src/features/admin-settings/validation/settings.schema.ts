// apps/web/src/features/admin-settings/validation/settings.schema.ts
import { z } from 'zod'

export const strongRulesSchema = z.object({
  minLength: z.number().min(6).max(64),
  requireUpper: z.boolean(),
  requireLower: z.boolean(),
  requireNumber: z.boolean(),
  requireSymbol: z.boolean(),
  forbidRepeated: z.boolean(),
  forbidCommon: z.boolean(),
})

export const settingsSchema = z.object({
  systemName: z.string().min(1).max(50),
  allowUserRegistration: z.boolean(),
  dateTimeFormat: z.string().min(1).max(50).optional(),
  requireEmailVerification: z.boolean().optional(),
  loginLivenessLevel: z.enum(['none', 'silent', 'action']).optional(),
  enrollLivenessLevel: z.enum(['none', 'silent', 'action']).optional(),
  maxLoginAttempts: z.number().min(1).max(20),

  // 可写不读
  defaultPassword: z.string().min(6).max(20).optional().or(z.literal('')),

  // ✅ 新增
  enableCaptcha: z.boolean(),
  captchaAfterFailedAttempts: z.number().min(1).max(20),

  enableStrongPassword: z.boolean(),
  strongPasswordRules: strongRulesSchema,

  // ✅ 水印
  watermarkEnabled: z.boolean(),
  watermarkServerEnabled: z.boolean(),
  watermarkScope: z.enum(['all', 'exam']),
  watermarkContent: z.string().max(200),
  watermarkOpacity: z.number().min(0.02).max(1),
  watermarkFontSize: z.number().int().min(10).max(48),
  watermarkRotate: z.number().int().min(-90).max(90),
  watermarkGap: z.number().int().min(20).max(400),
  watermarkColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),

  aiEnabled: z.boolean(),
  aiProvider: z.enum(['deepseek', 'openai', 'custom', 'local']),
  aiBaseUrl: z.string().max(300).optional().or(z.literal('')).default(''),
  aiApiKey: z.string().max(300).optional().or(z.literal('')),
  aiApiKeySet: z.boolean().optional(),
  aiModel: z.string().min(1).max(100),
  aiAllowedModels: z.string().max(500).optional().or(z.literal('')).default(''),
  aiTemperature: z.number().min(0).max(2),
  aiMaxTokens: z.number().min(1).max(100000),
  aiTimeoutMs: z.number().min(1000).max(300000),
  aiThinkingMode: z.enum(['enabled', 'disabled']),
})

export type SettingsInput = z.infer<typeof settingsSchema>
