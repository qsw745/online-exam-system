import type { ExamVaultAdapter } from './examVault.types'

export function createWebExamVault(storage: Storage): ExamVaultAdapter {
  return {
    async read(key) {
      return storage.getItem(key)
    },
    async write(key, value) {
      storage.setItem(key, value)
    },
    async remove(key) {
      storage.removeItem(key)
    },
  }
}
