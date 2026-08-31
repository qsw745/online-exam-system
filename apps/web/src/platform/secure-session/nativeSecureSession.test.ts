import { describe, expect, it } from 'vitest'

import { createNativeSecureSessionAdapter } from './nativeSecureSession'
import type { StoredNativeSession } from './secureSession.types'

describe('nativeSecureSession', () => {
  it('原生没有保存会话时返回 null', async () => {
    const adapter = createNativeSecureSessionAdapter({
      read: async () => ({}),
      write: async () => undefined,
      clear: async () => undefined,
    })

    await expect(adapter.read()).resolves.toBeNull()
  })

  it('写入时完整保留会话和过期时间', async () => {
    let stored: StoredNativeSession | null = null
    const adapter = createNativeSecureSessionAdapter({
      read: async () => ({ session: stored ?? undefined }),
      write: async (session) => {
        stored = session
      },
      clear: async () => {
        stored = null
      },
    })
    const session: StoredNativeSession = {
      accessToken: 'signed-token',
      mode: '7d',
      expiresAt: 1_800_000_000_000,
    }

    await adapter.write(session)

    await expect(adapter.read()).resolves.toEqual(session)
  })

  it('原生清理失败必须传递给调用方', async () => {
    const adapter = createNativeSecureSessionAdapter({
      read: async () => ({}),
      write: async () => undefined,
      clear: async () => {
        throw new Error('keychain-clear-failed')
      },
    })

    await expect(adapter.clear()).rejects.toThrow('keychain-clear-failed')
  })
})
