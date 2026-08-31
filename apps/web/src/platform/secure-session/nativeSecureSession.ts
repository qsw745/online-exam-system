import { registerPlugin } from '@capacitor/core'

import type { SecureSessionAdapter, StoredNativeSession } from './secureSession.types'

export type WenhengSecureSessionPlugin = {
  read(): Promise<{ session?: StoredNativeSession }>
  write(options: StoredNativeSession): Promise<void>
  clear(): Promise<void>
}

export const WenhengSecureSession = registerPlugin<WenhengSecureSessionPlugin>('WenhengSecureSession')

export function createNativeSecureSessionAdapter(
  plugin: WenhengSecureSessionPlugin = WenhengSecureSession,
): SecureSessionAdapter {
  return {
    async read() {
      const result = await plugin.read()
      return result.session ?? null
    },
    async write(session) {
      await plugin.write(session)
    },
    async clear() {
      await plugin.clear()
    },
  }
}

export const nativeSecureSession = createNativeSecureSessionAdapter()
