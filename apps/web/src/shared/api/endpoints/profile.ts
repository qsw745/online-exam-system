import { api } from '../core/httpClient'

export interface ProfileForm {
  avatar?: string
  nickname?: string
  email?: string
  phone?: string
  bio?: string
  // …按需补充
}

export const profileApi = {
  get: () => api.get<ProfileForm>('/profile'),
  update: (payload: ProfileForm) => api.put<ProfileForm>('/profile', payload),
  updateAvatar: (fileIdOrUrl: string) => api.put<ProfileForm>('/profile/avatar', { value: fileIdOrUrl }),
}

/** 兼容旧命名 */
export const profile = profileApi
export type { ProfileForm as ProfileDTO }
