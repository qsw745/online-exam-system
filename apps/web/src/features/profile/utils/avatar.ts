import { getCurrentApiUrl } from '@/shared/api/core/httpClient'

export function getAbsoluteAvatarUrl(raw?: string, base = getCurrentApiUrl()) {
  if (!raw) return ''
  if (/^(https?:|blob:|data:image\/)/i.test(raw)) return raw
  try {
    const api = new URL(base, window.location.origin)
    // 后端返回 /api/uploads/...，应按服务端 origin 解析，避免重复拼接 /api。
    return new URL(raw, raw.startsWith('/') ? api.origin : `${api.href.replace(/\/$/, '')}/`).href
  } catch { return raw.startsWith('/') ? raw : `/${raw}` }
}

export function revokeObjectUrl(url?: string) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
}
