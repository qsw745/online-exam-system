import { describe, expect, it, vi } from 'vitest'

import { createNativeExamVaultAdapter, type WenhengExamVaultPlugin } from './nativeExamVault'

describe('iOS 原生考试保险箱适配器', () => {
  it('以显式键值调用原生读写和删除能力', async () => {
    const plugin: WenhengExamVaultPlugin = {
      read: vi.fn(async () => ({ value: '{"answers":{}}' })),
      write: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
      uptime: vi.fn(async () => ({ milliseconds: 123_000 })),
    }
    const adapter = createNativeExamVaultAdapter(plugin)

    await expect(adapter.read('attempt-key')).resolves.toBe('{"answers":{}}')
    await adapter.write('attempt-key', 'encrypted-at-native-boundary')
    await adapter.remove('attempt-key')
    await expect(adapter.systemUptimeMs?.()).resolves.toBe(123_000)

    expect(plugin.read).toHaveBeenCalledWith({ key: 'attempt-key' })
    expect(plugin.write).toHaveBeenCalledWith({ key: 'attempt-key', value: 'encrypted-at-native-boundary' })
    expect(plugin.remove).toHaveBeenCalledWith({ key: 'attempt-key' })
  })

  it('原生保险箱没有内容时返回 null', async () => {
    const adapter = createNativeExamVaultAdapter({
      read: async () => ({}),
      write: async () => undefined,
      remove: async () => undefined,
      uptime: async () => ({ milliseconds: 1 }),
    })
    await expect(adapter.read('missing')).resolves.toBeNull()
  })
})
