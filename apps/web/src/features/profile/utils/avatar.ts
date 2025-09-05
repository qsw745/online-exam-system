// features/profile/utils/avatar.ts
export function getAbsoluteAvatarUrl(raw?: string, base = import.meta.env.VITE_API_URL || '') {
  if (!raw) return ''
  return raw.startsWith('http') ? raw : `${base}${raw}`
}

export function revokeObjectUrl(url?: string) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
}
