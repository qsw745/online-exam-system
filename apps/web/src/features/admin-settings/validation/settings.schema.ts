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
  maxLoginAttempts: z.number().min(1).max(20),

  // 可写不读
  defaultPassword: z.string().min(6).max(20).optional().or(z.literal('')),

  // ✅ 新增
  enableCaptcha: z.boolean(),
  captchaAfterFailedAttempts: z.number().min(1).max(20),

  enableStrongPassword: z.boolean(),
  strongPasswordRules: strongRulesSchema,
})

export type SettingsInput = z.infer<typeof settingsSchema>
