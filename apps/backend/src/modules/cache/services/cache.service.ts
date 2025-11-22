let RC: any = null
let redisClient: any = null
;(async () => {
  try {
    RC = (await import('@/common/redis/cache')).default || (await import('@/common/redis/cache'))
  } catch {
    RC = null
  }
  try {
    redisClient = (await import('@/common/redis/client')).redis
  } catch {
    redisClient = null
  }
})()

export class CacheService {
  async stats() {
    try {
      if (!redisClient?.info) throw new Error('cache client unavailable')
      const infoRaw = await redisClient.info()
      const info: Record<string, string> = {}
      let totalKeys = 0
      infoRaw
        .split('\n')
        .forEach((line: string) => {
          if (!line || line.startsWith('#')) return
          const parts = line.split(':')
          if (parts.length !== 2) return
          const [k, v] = parts as [string, string]
          if (k.startsWith('db')) {
            const metrics = Object.fromEntries(
              v.split(',').map(entry => {
                const [mk, mv] = entry.split('=')
                return [mk, mv]
              })
            )
            totalKeys += Number(metrics.keys ?? 0)
            return
          }
          info[k] = v
        })

      const uptimeSeconds = Number(info.uptime_in_seconds || 0)
      const formatSeconds = (sec: number) => {
        if (!sec) return '0s'
        const parts: string[] = []
        const days = Math.floor(sec / 86400)
        const hours = Math.floor((sec % 86400) / 3600)
        const minutes = Math.floor((sec % 3600) / 60)
        const seconds = sec % 60
        if (days) parts.push(`${days}d`)
        if (hours) parts.push(`${hours}h`)
        if (minutes) parts.push(`${minutes}m`)
        if (seconds || !parts.length) parts.push(`${seconds}s`)
        return parts.join(' ')
      }

      const humanizeBytes = (bytes: number) => {
        if (!Number.isFinite(bytes)) return `${bytes} B`
        if (bytes === 0) return '0 B'
        const units = ['B', 'KB', 'MB', 'GB', 'TB']
        const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
        const value = bytes / Math.pow(1024, idx)
        return `${value.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`
      }

      return {
        connected: true,
        version: info.redis_version,
        uptime: uptimeSeconds,
        uptimeSeconds,
        uptimeHuman: formatSeconds(uptimeSeconds),
        memoryUsed: info.used_memory_human || humanizeBytes(Number(info.used_memory || 0)),
        keys: totalKeys,
        keysTotal: totalKeys,
        keysHuman: `${totalKeys.toLocaleString()} keys`,
      }
    } catch {
      return { connected: false }
    }
  }

  async flushAll() {
    try {
      if (!redisClient?.flushdb) return false
      await redisClient.flushdb()
      return true
    } catch {
      return false
    }
  }
}
