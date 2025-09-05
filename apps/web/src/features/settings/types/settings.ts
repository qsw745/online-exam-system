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

export interface UserSettings {
  notifications: NotificationSettings
  privacy: PrivacySettings
  appearance: AppearanceSettings
}
