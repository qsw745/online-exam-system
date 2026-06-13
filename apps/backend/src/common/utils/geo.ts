// apps/backend/src/common/utils/geo.ts
export type GeoLocation = {
  country?: string
  region?: string
  city?: string
  lat?: number
  lon?: number
  label: string
  source: 'geoip-lite' | 'none'
}

function isPrivateOrLoopback(ip?: string) {
  if (!ip) return true
  return /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|::1|fc00:|fe80:)/i.test(ip)
}

/** 解析 IP 为登录地点；未命中时返回 label: '未知'；内网返回 '内网/本机' */
export class Geo {
  static async lookup(ip?: string | null): Promise<GeoLocation> {
    const addr = (ip || '').trim()
    if (!addr || isPrivateOrLoopback(addr)) {
      return { label: '内网/本机', source: 'none' }
    }
    try {
      const mod: any = await import('geoip-lite').catch(() => null)
      const geoip: any = mod?.default ?? mod
      if (geoip?.lookup) {
        const hit = geoip.lookup(addr)
        if (hit) {
          const country = hit.country || undefined
          const region = Array.isArray(hit.region) ? hit.region[0] : hit.region || undefined
          const city = hit.city || undefined
          const lat = Array.isArray(hit.ll) ? hit.ll[0] : undefined
          const lon = Array.isArray(hit.ll) ? hit.ll[1] : undefined
          const label = [country, region, city].filter(Boolean).join(' · ') || '未知'
          return { country, region, city, lat, lon, label, source: 'geoip-lite' }
        }
      }
    } catch {
      /* ignore */
    }
    return { label: '未知', source: 'none' }
  }
}

export default Geo
