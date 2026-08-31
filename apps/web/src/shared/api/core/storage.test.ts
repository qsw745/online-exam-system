import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SecureSessionAdapter, StoredNativeSession } from '@/platform/secure-session/secureSession.types'
import {
  clearTokenAll,
  getAccessToken,
  initializeAuthStorage,
  setAccessToken,
  setAuthStorageFlag,
} from './storage'

class MemorySecureSession implements SecureSessionAdapter {
  constructor(public session: StoredNativeSession | null = null) {}

  async read() {
    return this.session
  }

  async write(session: StoredNativeSession) {
    this.session = session
  }

  async clear() {
    this.session = null
  }
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value))
  }
}

describe('auth storage', () => {
  beforeAll(() => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    vi.stubGlobal('sessionStorage', new MemoryStorage())
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(async () => {
    localStorage.clear()
    sessionStorage.clear()
    await initializeAuthStorage()
  })

  afterEach(async () => {
    vi.useRealTimers()
    await initializeAuthStorage()
    localStorage.clear()
    sessionStorage.clear()
  })

  it.each([
    ['session', 'sessionStorage'],
    ['local', 'localStorage'],
    ['7d', 'localStorage'],
  ] as const)('Web %s 模式保持原有 %s 存储行为', async (mode, expectedStorage) => {
    setAuthStorageFlag(mode)

    await setAccessToken(`${mode}-token`, mode)

    expect(getAccessToken()).toBe(`${mode}-token`)
    expect(sessionStorage.getItem('token')).toBe(expectedStorage === 'sessionStorage' ? `${mode}-token` : null)
    expect(localStorage.getItem('token')).toBe(expectedStorage === 'localStorage' ? `${mode}-token` : null)
  })

  it('原生初始化只把 Keychain 会话载入内存', async () => {
    const adapter = new MemorySecureSession({
      accessToken: 'native-token',
      mode: 'local',
      expiresAt: null,
    })

    await initializeAuthStorage(adapter)

    expect(getAccessToken()).toBe('native-token')
    expect(localStorage.getItem('token')).toBeNull()
    expect(sessionStorage.getItem('token')).toBeNull()
  })

  it('原生写入完成前不暴露尚未持久化的令牌', async () => {
    let finishWrite: (() => void) | undefined
    const adapter: SecureSessionAdapter = {
      read: async () => null,
      write: async () => new Promise<void>((resolve) => {
        finishWrite = resolve
      }),
      clear: async () => undefined,
    }
    await initializeAuthStorage(adapter)

    const pending = setAccessToken('pending-token', 'session')
    await vi.waitFor(() => expect(finishWrite).toBeTypeOf('function'))
    expect(getAccessToken()).toBeNull()
    finishWrite?.()
    await pending

    expect(getAccessToken()).toBe('pending-token')
  })

  it('原生初始化会清除已过期的 7 天会话', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-30T08:00:00Z'))
    const adapter = new MemorySecureSession({
      accessToken: 'expired-token',
      mode: '7d',
      expiresAt: Date.now() - 1,
    })

    await initializeAuthStorage(adapter)

    expect(getAccessToken()).toBeNull()
    expect(adapter.session).toBeNull()
  })

  it('原生清理会同时清除内存和 Keychain', async () => {
    const adapter = new MemorySecureSession({
      accessToken: 'native-token',
      mode: 'local',
      expiresAt: null,
    })
    await initializeAuthStorage(adapter)

    await clearTokenAll()

    expect(getAccessToken()).toBeNull()
    expect(adapter.session).toBeNull()
  })
})
