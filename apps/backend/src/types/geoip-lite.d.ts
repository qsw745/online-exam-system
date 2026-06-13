// apps/backend/src/types/geoip-lite.d.ts
declare module 'geoip-lite' {
  export type GeoLookup = {
    range: [number, number]
    country: string
    region: string
    eu?: string
    timezone?: string
    city?: string
    ll: [number, number]
    metro?: number
    area?: number
  } | null

  export function lookup(ip: string): GeoLookup
}
