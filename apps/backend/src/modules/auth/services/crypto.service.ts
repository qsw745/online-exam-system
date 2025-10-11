/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 说明：
 * - 避免静态 import 'crypto' 导致 TS2307（没有 @types/node 也能编译）
 * - 使用 runtime require('node:crypto' | 'crypto')
 * - 不显式引用 Buffer 类型，改用 (globalThis as any).Buffer
 */

declare const require: any

const crypto: any = (() => {
  try {
    return require('node:crypto')
  } catch {
    try {
      return require('crypto')
    } catch {
      // 极端环境下给出清晰错误
      throw new Error('Node.js crypto 模块不可用，请确认在 Node 环境运行')
    }
  }
})()

// 在进程内生成一对 RSA 密钥（如需持久化，可改为读写磁盘/Redis）
const pair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

export const CryptoService = {
  getPublicKey() {
    return { alg: 'RSA-OAEP-256', pem: pair.publicKey as string }
  },

  /**
   * enc: base64 字符串
   * 解密后应为 JSON：{ email, password, ts, nonce }
   * 允许 120 秒时间漂移，避免重放
   */
  decryptLoginCred(enc: string) {
    const B: any = (globalThis as any).Buffer
    if (!B?.from) throw new Error('Buffer 不可用（非 Node 环境？）')

    const buf = B.from(enc, 'base64')
    const plain: any = crypto.privateDecrypt(
      { key: pair.privateKey, oaepHash: 'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
      buf
    )
    const obj = JSON.parse(plain.toString('utf8'))
    if (!obj || typeof obj !== 'object') throw new Error('解密失败')

    const ts = Number(obj.ts ?? 0)
    const skew = Math.abs(Date.now() - ts)
    if (!Number.isFinite(ts) || skew > 120_000) {
      throw new Error('凭证已过期，请重试')
    }
    if (!obj.email || !obj.password) {
      throw new Error('凭证不完整')
    }
    return { email: String(obj.email), password: String(obj.password) }
  },
}

export default CryptoService
