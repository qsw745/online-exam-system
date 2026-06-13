import { api } from '../core/httpClient'

export interface ProfileForm {
  avatar?: string
  avatar_url?: string
  nickname?: string
  email?: string
  phone?: string
  bio?: string
  // 新增：页面已用到
  school?: string
  class_name?: string
}

export const profileApi = {
  // 获取当前登录用户资料
  get: () => api.get<ProfileForm>('/profile'),

  // 更新资料（昵称/学校/班级/邮箱/电话/签名等）
  update: (payload: ProfileForm) => {
    // 过滤空字符串，避免后端校验失败（如 phone 为空字符串）
    const normalized: ProfileForm = {}
    Object.entries(payload || {}).forEach(([k, v]) => {
      if (typeof v === 'string') {
        const trimmed = v.trim()
        if (trimmed) (normalized as any)[k] = trimmed
      } else if (v !== undefined) {
        ;(normalized as any)[k] = v
      }
    })
    return api.put<ProfileForm>('/profile', normalized)
  },

  // 旧接口：直接用字符串更新头像（比如你已经有 OSS URL）
  updateAvatar: (fileIdOrUrl: string) => api.put<ProfileForm>('/profile/avatar', { value: fileIdOrUrl }),

  // ✅ 新增：上传文件表单（multipart/form-data）
  // 后端已支持同一路径 PUT + multipart
  uploadAvatar: (formData: FormData) =>
    api.put<ProfileForm>('/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
}

/** 兼容旧命名 */
export const profile = profileApi
export type { ProfileForm as ProfileDTO }
