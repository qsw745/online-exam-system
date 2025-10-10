import IORedis, { type RedisOptions } from 'ioredis'
import { appLogger } from '@/infrastructure/logging/logger'

const {
  REDIS_URL,
  REDIS_HOST = '127.0.0.1',
  REDIS_PORT = '6379',
  REDIS_PASSWORD = '',
  REDIS_DB = '0',
  REDIS_STRICT = '1', // 1=严格；0=宽松
  REDIS_STARTUP_TIMEOUT_MS = '10000',
  REDIS_RUNTIME_GRACE_MS = '30000',
  REDIS_PREFIX = '',
} = process.env as Record<string, string | undefined>

const STRICT = REDIS_STRICT !== '0'
const STARTUP_TIMEOUT = Number(REDIS_STARTUP_TIMEOUT_MS) || 10000
const RUNTIME_GRACE_MS = Number(REDIS_RUNTIME_GRACE_MS) || 30000

function createClient(name: 'main' | 'pub' | 'sub') {
  const baseCommon = {
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: 1,
    retryStrategy(times: number) {
      const delay = Math.min(2000, 100 + times * 100)
      return delay
    },
    keyPrefix: REDIS_PREFIX || '',
  } satisfies Partial<RedisOptions>

  const base: RedisOptions = REDIS_URL
    ? (baseCommon as RedisOptions)
    : ({
        ...baseCommon,
        host: REDIS_HOST,
        port: Number(REDIS_PORT),
        password: REDIS_PASSWORD || undefined,
        db: Number(REDIS_DB) || 0,
      } as RedisOptions)

  const client = REDIS_URL ? new IORedis(REDIS_URL, base) : new IORedis(base)

  client.on('connect', () => appLogger.info(`[redis:${name}] connecting...`))
  client.on('ready', () => appLogger.info(`[redis:${name}] ready`))
  client.on('error', err => appLogger.error(`[redis:${name}] error`, { err }))
  client.on('close', () => appLogger.warn(`[redis:${name}] closed`))
  client.on('reconnecting', () => appLogger.warn(`[redis:${name}] reconnecting...`))
  client.on('end', () => appLogger.warn(`[redis:${name}] end`))

  return client
}

export const redis = createClient('main')
export const redisPub = createClient('pub')
export const redisSub = createClient('sub')

// 健康标记
let _redisReady = false
export const isRedisReady = () => _redisReady
export function requireRedis() {
  if (!_redisReady) throw new Error('REDIS_UNAVAILABLE')
}

// 等待 ready（无 off -> 用 removeListener）
function waitReady(client: IORedis, name: string, timeoutMs: number) {
  if ((client as any).status === 'ready') return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const onReady = () => {
      clear()
      resolve()
    }
    const onError = (err: unknown) => {
      clear()
      reject(err instanceof Error ? err : new Error(String(err)))
    }
    const onTimeout = () => {
      clear()
      reject(new Error(`[redis:${name}] ready timeout after ${timeoutMs}ms`))
    }
    const t = setTimeout(onTimeout, timeoutMs)
    const clear = () => {
      clearTimeout(t)
      ;(client as any).removeListener?.('ready', onReady)
      ;(client as any).removeListener?.('error', onError)
    }
    client.once('ready', onReady)
    client.once('error', onError)
  })
}

// 运行期看门狗（不用 NodeJS.Timeout 类型，避免 @types/node 依赖）
function armRuntimeWatchdog(client: IORedis, name: string) {
  let timer: ReturnType<typeof setTimeout> | null = null
  const arm = () => {
    if (!STRICT || timer) return
    timer = setTimeout(() => {
      appLogger.error(`[redis:${name}] not recovered within ${RUNTIME_GRACE_MS}ms, exiting`)
      process.exit(1)
    }, RUNTIME_GRACE_MS)
  }
  const disarm = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }
  client.on('ready', () => {
    disarm()
    _redisReady = true
  })
  const markDegraded = () => {
    _redisReady = false
    if (STRICT) arm()
  }
  client.on('end', markDegraded)
  client.on('close', markDegraded)
  client.on('reconnecting', markDegraded)
  client.on('error', markDegraded)
}

// —— 初始化 —— //
export const redisReady = (async () => {
  try {
    await Promise.all([redis.connect(), redisPub.connect(), redisSub.connect()])
    await Promise.all([
      waitReady(redis, 'main', STARTUP_TIMEOUT),
      waitReady(redisPub, 'pub', STARTUP_TIMEOUT),
      waitReady(redisSub, 'sub', STARTUP_TIMEOUT),
    ])
    const pong = await redis.ping()
    appLogger.info('[redis] ping ok', { pong })
    _redisReady = true

    armRuntimeWatchdog(redis, 'main')
    armRuntimeWatchdog(redisPub, 'pub')
    armRuntimeWatchdog(redisSub, 'sub')

    return true
  } catch (e) {
    appLogger.error('[redis] init failed, exiting', { err: e })
    process.exit(1)
  }
})()

export default redisPub
