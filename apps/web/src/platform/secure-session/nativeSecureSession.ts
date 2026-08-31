import { registerPlugin } from '@capacitor/core'

import type { SecureSessionAdapter, StoredNativeSession } from './secureSession.types'

export type WenhengSecureSessionPlugin = {
  read(): Promise<{ session?: StoredNativeSession }>
  write(options: StoredNativeSession): Promise<void>
  clear(): Promise<void>
  readDeletionStatus(): Promise<{ credential?: DeletionStatusCredential }>
  writeDeletionStatus(options: DeletionStatusCredential): Promise<void>
  clearDeletionStatus(): Promise<void>
}

export type DeletionStatusCredential = { requestId: string; statusToken: string }
export type WenhengDeletionStatusPlugin = Pick<
  WenhengSecureSessionPlugin,
  'readDeletionStatus' | 'writeDeletionStatus' | 'clearDeletionStatus'
>

export const WenhengSecureSession = registerPlugin<WenhengSecureSessionPlugin>('WenhengSecureSession')

export function createNativeSecureSessionAdapter(
  plugin: Pick<WenhengSecureSessionPlugin, 'read' | 'write' | 'clear'> = WenhengSecureSession,
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
