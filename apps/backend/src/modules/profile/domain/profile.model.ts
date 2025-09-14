export interface ProfileDTO {
    avatar?: string | null
    nickname?: string | null
    email?: string | null
    phone?: string | null
    bio?: string | null
}

export interface UpdateProfilePayload {
    avatar?: string | null
    nickname?: string | null
    email?: string | null
    phone?: string | null
    bio?: string | null
}

export interface UpdateAvatarPayload {
    value: string
}
