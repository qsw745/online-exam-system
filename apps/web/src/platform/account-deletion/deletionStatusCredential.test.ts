import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createClientDeletionStatusToken,
  createDeletionStatusCredentialStore,
} from './deletionStatusCredential'

const credential = {
  requestId: 'b132689c-4a5d-42a2-86c5-3661e62d4d1f',
  statusToken: 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc',
}

class MemoryStorage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
}

describe('deletionStatusCredential', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', new MemoryStorage())
    vi.stubGlobal('localStorage', new MemoryStorage())
    sessionStorage.clear()
    localStorage.clear()
  })

  it('Web 注销状态凭证只写 sessionStorage', async () => {
    const store = createDeletionStatusCredentialStore({ target: 'web' })
    await store.write(credential)
    expect(sessionStorage.getItem('wenheng.deletion-status.v1')).toContain(credential.requestId)
    expect(localStorage.getItem('wenheng.deletion-status.v1')).toBeNull()
    await expect(store.read()).resolves.toEqual(credential)
  })

  it('iOS 注销状态凭证只写独立原生项且不落 Web 存储', async () => {
    let nativeCredential: typeof credential | null = null
    const store = createDeletionStatusCredentialStore({
      target: 'ios',
      plugin: {
        readDeletionStatus: async () => ({ credential: nativeCredential ?? undefined }),
        writeDeletionStatus: async value => { nativeCredential = value },
        clearDeletionStatus: async () => { nativeCredential = null },
      },
    })
    await store.write(credential)
    await expect(store.read()).resolves.toEqual(credential)
    expect(sessionStorage.length).toBe(0)
    expect(localStorage.length).toBe(0)
  })

  it('原生清理失败必须传递，不能静默丢失恢复能力', async () => {
    const store = createDeletionStatusCredentialStore({
      target: 'ios',
      plugin: {
        readDeletionStatus: async () => ({ credential }),
        writeDeletionStatus: async () => undefined,
        clearDeletionStatus: async () => { throw new Error('keychain-clear-failed') },
      },
    })
    await expect(store.clear()).rejects.toThrow('keychain-clear-failed')
  })

  it('客户端状态令牌固定使用 32 字节安全随机源并输出 Base64URL', () => {
    const cryptoSource = {
      getRandomValues<T extends ArrayBufferView | null>(array: T): T {
        const bytes = array as Uint8Array
        bytes.fill(7)
        return array
      },
    }
    expect(createClientDeletionStatusToken(cryptoSource)).toBe(credential.statusToken)
  })
})
