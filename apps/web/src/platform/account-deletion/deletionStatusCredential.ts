import { Capacitor } from '@capacitor/core'

import { resolveAppTarget, type AppTarget } from '../appTarget'
import {
  WenhengSecureSession,
  type DeletionStatusCredential,
  type WenhengDeletionStatusPlugin,
} from '../secure-session/nativeSecureSession'

export type { DeletionStatusCredential }

export interface DeletionStatusCredentialStore {
  read(): Promise<DeletionStatusCredential | null>
  write(credential: DeletionStatusCredential): Promise<void>
  clear(): Promise<void>
}

const STORAGE_KEY = 'wenheng.deletion-status.v1'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const STATUS_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

const isValidCredential = (value: unknown): value is DeletionStatusCredential => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DeletionStatusCredential>
  return UUID_RE.test(String(candidate.requestId ?? ''))
    && STATUS_TOKEN_RE.test(String(candidate.statusToken ?? ''))
}

const currentTarget = (): AppTarget => resolveAppTarget(
  import.meta.env.VITE_APP_TARGET,
  Capacitor.isNativePlatform(),
)

export function createDeletionStatusCredentialStore(options: {
  target?: AppTarget
  plugin?: WenhengDeletionStatusPlugin
  session?: Storage
} = {}): DeletionStatusCredentialStore {
  const target = options.target ?? currentTarget()
  if (target === 'ios') {
    const plugin = options.plugin ?? WenhengSecureSession
    return {
      async read() {
        const result = await plugin.readDeletionStatus()
        return isValidCredential(result.credential) ? result.credential : null
      },
      async write(credential) {
        if (!isValidCredential(credential)) throw new Error('注销状态凭证格式无效')
        await plugin.writeDeletionStatus(credential)
      },
      async clear() {
        await plugin.clearDeletionStatus()
      },
    }
  }

  const storage = options.session ?? sessionStorage
  return {
    async read() {
      const raw = storage.getItem(STORAGE_KEY)
      if (!raw) return null
      try {
        const parsed = JSON.parse(raw)
        return isValidCredential(parsed) ? parsed : null
      } catch {
        return null
      }
    },
    async write(credential) {
      if (!isValidCredential(credential)) throw new Error('注销状态凭证格式无效')
      storage.setItem(STORAGE_KEY, JSON.stringify(credential))
    },
    async clear() {
      storage.removeItem(STORAGE_KEY)
    },
  }
}

export function createClientDeletionStatusToken(
  cryptoSource: Pick<Crypto, 'getRandomValues'> = globalThis.crypto,
): string {
  if (!cryptoSource?.getRandomValues) throw new Error('当前环境不支持安全随机数')
  const bytes = cryptoSource.getRandomValues(new Uint8Array(32))
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export const deletionStatusCredentialStore = createDeletionStatusCredentialStore()
