export interface ProfileDTO {
    avatar?: string | null
    nickname?: string | null
    email?: string | null
    phone?: string | null
    bio?: string | null
    school?: string | null
    class_name?: string | null
}

export interface UpdateProfilePayload {
  avatar?: string | null
  nickname?: string | null
  email?: string | null
  phone?: string | null
  bio?: string | null
  school?: string | null // ✅ 新增
  class_name?: string | null // ✅ 新增
}

export interface UpdateAvatarPayload {
    value: string
}
