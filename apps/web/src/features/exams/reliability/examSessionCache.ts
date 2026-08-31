import type { ExamVaultAdapter } from '@/platform/exam-vault'

const VERSION = 1 as const

export type ExamSessionIdentity = {
  userId: string | number
  routeId: string | number
}

export type CachedExamSession<T> = ExamSessionIdentity & {
  version: typeof VERSION
  payload: T
  deviceUptimeMs: number
  savedAt: string
}

export function examSessionKey(identity: ExamSessionIdentity) {
  return `wenheng:exam-session:v1:${identity.userId}:${identity.routeId}`
}

export async function saveExamSession<T>(
  storage: ExamVaultAdapter,
  identity: ExamSessionIdentity,
  payload: T,
  deviceUptimeMs: number,
  now: () => string = () => new Date().toISOString(),
) {
  if (!Number.isFinite(deviceUptimeMs) || deviceUptimeMs < 0) return false
  const session: CachedExamSession<T> = {
    version: VERSION,
    ...identity,
    payload,
    deviceUptimeMs,
    savedAt: now(),
  }
  try {
    await storage.write(examSessionKey(identity), JSON.stringify(session))
    return true
  } catch {
    return false
  }
}

export async function readExamSession<T>(
  storage: ExamVaultAdapter,
  identity: ExamSessionIdentity,
): Promise<
  | { status: 'missing' | 'invalid' | 'unavailable' }
  | { status: 'found'; session: CachedExamSession<T> }
> {
  let raw: string | null
  try {
    raw = await storage.read(examSessionKey(identity))
  } catch {
    return { status: 'unavailable' }
  }
  if (raw == null) return { status: 'missing' }
  try {
    const value: any = JSON.parse(raw)
    if (
      value?.version === VERSION &&
      String(value.userId) === String(identity.userId) &&
      String(value.routeId) === String(identity.routeId) &&
      value.payload && typeof value.payload === 'object' &&
      Number.isFinite(value.deviceUptimeMs) && value.deviceUptimeMs >= 0 &&
      typeof value.savedAt === 'string' && !Number.isNaN(Date.parse(value.savedAt))
    ) {
      return { status: 'found', session: value as CachedExamSession<T> }
    }
  } catch {
    // 统一在下方移除损坏快照。
  }
  try {
    await storage.remove(examSessionKey(identity))
  } catch {
    // 清理失败不阻断错误返回。
  }
  return { status: 'invalid' }
}

export async function clearExamSession(storage: ExamVaultAdapter, identity: ExamSessionIdentity) {
  try {
    await storage.remove(examSessionKey(identity))
    return true
  } catch {
    return false
  }
}

export function restoreCachedServerNow(
  serverNow: string,
  savedDeviceUptimeMs: number,
  currentDeviceUptimeMs: number,
): { ok: true; serverNow: string } | { ok: false; reason: 'device_restarted' | 'invalid_time' } {
  const serverNowMs = Date.parse(serverNow)
  if (!Number.isFinite(serverNowMs) || !Number.isFinite(savedDeviceUptimeMs) || !Number.isFinite(currentDeviceUptimeMs)) {
    return { ok: false, reason: 'invalid_time' }
  }
  if (currentDeviceUptimeMs < savedDeviceUptimeMs) return { ok: false, reason: 'device_restarted' }
  return {
    ok: true,
    serverNow: new Date(serverNowMs + currentDeviceUptimeMs - savedDeviceUptimeMs).toISOString(),
  }
}
