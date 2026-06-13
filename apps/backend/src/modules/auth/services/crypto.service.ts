/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 说明：
 * - 避免静态 import 'crypto' 导致 TS2307（没有 @types/node 也能编译）
 * - 使用 runtime require('node:crypto' | 'crypto')
 * - 不显式引用 Buffer 类型，改用 (globalThis as any).Buffer
 */

declare const require: any
declare const process: any

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

const fs: any = (() => {
  try {
    return require('node:fs')
  } catch {
    return require('fs')
  }
})()

const path: any = (() => {
  try {
    return require('node:path')
  } catch {
    return require('path')
  }
})()

function normalizePem(value?: string | null) {
  return value ? String(value).replace(/\\n/g, '\n').trim() : ''
}

function generatePair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
}

function derivePublicKey(privateKey: string) {
  return crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' })
}

function keyFilePath() {
  const configured = normalizePem(process?.env?.LOGIN_RSA_KEY_FILE)
  if (configured) return configured
  const secretsDir = normalizePem(process?.env?.SECRETS_DIR) || '/app/secrets'
  return path.join(secretsDir, 'login-rsa-keypair.json')
}

function loadPair() {
  const envPrivateKey = normalizePem(process?.env?.LOGIN_RSA_PRIVATE_KEY)
  const envPublicKey = normalizePem(process?.env?.LOGIN_RSA_PUBLIC_KEY)
  if (envPrivateKey) {
    return { privateKey: envPrivateKey, publicKey: envPublicKey || derivePublicKey(envPrivateKey) }
  }

  const file = keyFilePath()
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    const privateKey = normalizePem(raw?.privateKey)
    const publicKey = normalizePem(raw?.publicKey)
    if (privateKey && publicKey) return { privateKey, publicKey }
  } catch (err: any) {
    console.warn(
      `[CryptoService] Failed to load RSA keypair from ${file}; generating a new pair: ${err?.message || err}`
    )
  }

  const created = generatePair()
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(created), { mode: 0o600 })
  } catch {
    // If persistence is unavailable, login still works for this process lifetime.
  }
  return created
}

const pair = loadPair()

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

    const cred =
      obj.email || obj.password
        ? obj
        : obj.payload && typeof obj.payload === 'object'
          ? obj.payload
          : obj.data && typeof obj.data === 'object'
            ? obj.data
            : obj.cred && typeof obj.cred === 'object'
              ? obj.cred
              : obj

    const ts = Number(obj.ts ?? 0)
    const skew = Math.abs(Date.now() - ts)
    if (!Number.isFinite(ts) || skew > 120_000) {
      throw new Error('凭证已过期，请重试')
    }
    if (!cred.email || !cred.password) {
      throw new Error('凭证不完整')
    }
    return { email: String(cred.email), password: String(cred.password) }
  },
}

export default CryptoService
