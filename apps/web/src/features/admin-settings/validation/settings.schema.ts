// features/admin-settings/validation/settings.schema.ts
import { z } from 'zod'

export const settingsSchema = z.object({
  systemName: z.string().min(1).max(50),
  allowUserRegistration: z.boolean(),
  maxLoginAttempts: z.number().min(1).max(10),
  defaultPassword: z.string().min(6).max(20).optional().or(z.literal('')),
})

export type SettingsInput = z.infer<typeof settingsSchema>
