// features/settings/types/settings.ts
export type ProfileVisibility = 'public' | 'private'

export interface NotificationSettings {
  email: boolean
  push: boolean
  sound: boolean
}

export interface PrivacySettings {
  profile_visibility: ProfileVisibility
  show_activity: boolean
  show_results: boolean
}

export interface AppearanceSettings {
  language: 'zh-CN' | 'en-US'
}

export interface SecurityQuestionSettings {
  question: string
  answer: string
}

export interface AccountSecuritySettings {
  phone?: string
  backup_email?: string
  question?: string
  answer?: string
  questions?: SecurityQuestionSettings[]
}

export interface UserSettings {
  notifications: NotificationSettings
  privacy: PrivacySettings
  appearance: AppearanceSettings
  security?: AccountSecuritySettings
}
