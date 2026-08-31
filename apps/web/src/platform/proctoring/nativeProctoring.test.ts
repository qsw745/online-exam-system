import { describe, expect, it, vi } from 'vitest'
import { createNativeProctoringAdapter } from './nativeProctoring'

describe('nativeProctoring', () => {
  it('只通过受限原生接口启动传感器并读取有限身份帧', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    const plugin = {
      permissionStatus: vi.fn().mockResolvedValue({ camera: 'granted', microphone: 'granted' }),
      requestSensorPermissions: vi.fn().mockResolvedValue({ camera: 'granted', microphone: 'granted' }),
      start: vi.fn().mockResolvedValue({ running: true }),
      status: vi.fn().mockResolvedValue({ running: true }),
      captureIdentityFrames: vi.fn().mockResolvedValue({ images: ['data:image/jpeg;base64,abc'] }),
      stop: vi.fn().mockResolvedValue(undefined),
      openSettings: vi.fn().mockResolvedValue(undefined),
      addListener: vi.fn().mockResolvedValue({ remove }),
    }
    const adapter = createNativeProctoringAdapter(plugin as any)
    expect(adapter.kind).toBe('native')
    expect(await adapter.captureIdentityFrames()).toEqual(['data:image/jpeg;base64,abc'])
    const unsubscribe = await adapter.addFactListener(() => {})
    await unsubscribe()
    expect(plugin.addListener).toHaveBeenCalledWith('proctoringFact', expect.any(Function))
    expect(remove).toHaveBeenCalledOnce()
  })
})
