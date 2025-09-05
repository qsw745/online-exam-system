// src/features/profile/api.ts
import { api } from '@shared/api/http'

export type ProfileForm = {
  nickname: string
  school: string
  class_name: string
}

export const profileApi = {
  /** 获取当前登录用户 */
  getMe() {
    return api.get('/users/me')
  },

  /** 更新当前用户资料 */
  update(payload: ProfileForm) {
    return api.put('/users/me', payload)
  },

  /** 上传头像（字段名 avatar） */
  uploadAvatar(formData: FormData) {
    return api.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  /** 获取设置 */
  getSettings() {
    return api.get('/users/settings')
  },

  /** 保存设置 */
  saveSettings(payload: any) {
    return api.post('/users/settings', payload)
  },
}
