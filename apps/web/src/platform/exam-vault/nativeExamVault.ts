import { registerPlugin } from '@capacitor/core'

import type { ExamVaultAdapter } from './examVault.types'

export type WenhengExamVaultPlugin = {
  read(options: { key: string }): Promise<{ value?: string }>
  write(options: { key: string; value: string }): Promise<void>
  remove(options: { key: string }): Promise<void>
  uptime(): Promise<{ milliseconds: number }>
}

export const WenhengExamVault = registerPlugin<WenhengExamVaultPlugin>('WenhengExamVault')

export function createNativeExamVaultAdapter(
  plugin: WenhengExamVaultPlugin = WenhengExamVault,
): ExamVaultAdapter {
  return {
    async read(key) {
      const result = await plugin.read({ key })
      return result.value ?? null
    },
    write(key, value) {
      return plugin.write({ key, value })
    },
    remove(key) {
      return plugin.remove({ key })
    },
    async systemUptimeMs() {
      const result = await plugin.uptime()
      return result.milliseconds
    },
  }
}

export const nativeExamVault = createNativeExamVaultAdapter()
