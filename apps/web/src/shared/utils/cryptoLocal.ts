// apps/web/src/shared/utils/cryptoLocal.ts
// 本地“记住我”加解密（AES-GCM，WebCrypto）+ 登录凭据远端加密（RSA-OAEP-256）

import { http } from '@/shared/api/core/httpClient' // ✅ 统一 axios

const TEXT = 'utf-8'
const REMEMBER_SALT = 'login-remember-v1'

// —— 环境能力探测 —— //
const hasSubtle = (() => {
  try {
    return typeof window !== 'undefined' && !!window.crypto && !!window.crypto.subtle
  } catch {
    return false
  }
})()

// —— 小工具 —— //
function getSecret(): string {
  return (import.meta as any)?.env?.VITE_APP_KDF_SECRET || 'dev-weak-secret'
}

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function b64ToBytes(b64s: string): Uint8Array {
  const raw = atob(b64s)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/**
 * ✅ 把 Uint8Array 转成“干净”的 ArrayBuffer（不依赖 .buffer.slice）
 * 通过新建 ArrayBuffer 再 set 拷贝，规避 TS 把返回类型推成 ArrayBuffer | SharedArrayBuffer 的问题
 */
function u8ToArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength)
  new Uint8Array(ab).set(u8)
  return ab
}

function randNonce(bytes = 12): string {
  const a = new Uint8Array(bytes)
  if (typeof crypto?.getRandomValues === 'function') {
    crypto.getRandomValues(a)
  } else {
    for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256)
  }
  return b64(a)
}

// —— 本地 AES-GCM（用于“记住我”） —— //
async function deriveKey(secret: string) {
  if (!hasSubtle) throw new Error('WebCrypto subtle not available for AES-GCM')
  const enc = new TextEncoder()
  const salt = enc.encode(REMEMBER_SALT)
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 120_000 },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptLocal(plain: string): Promise<string> {
  if (!hasSubtle) return `plain.${btoa(plain)}` // 极端降级
  const ivU8 = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(getSecret())
  const dataU8 = new TextEncoder().encode(plain)
  // ✅ 统一传 ArrayBuffer
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: u8ToArrayBuffer(ivU8) }, key, u8ToArrayBuffer(dataU8))
  return `${b64(ivU8)}.${b64(ct)}`
}

export async function decryptLocal(pack: string | null): Promise<string | null> {
  if (!pack || !pack.includes('.')) return null
  const [ivb64, ctb64] = pack.split('.')
  if (ivb64 === 'plain') {
    try {
      return atob(ctb64)
    } catch {
      return null
    }
  }
  if (!hasSubtle) return null
  try {
    const ivU8 = b64ToBytes(ivb64)
    const ctU8 = b64ToBytes(ctb64)
    const key = await deriveKey(getSecret())
    // ✅ 统一传 ArrayBuffer
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8ToArrayBuffer(ivU8) }, key, u8ToArrayBuffer(ctU8))
    return new TextDecoder(TEXT).decode(pt)
  } catch {
    return null
  }
}

// —— 获取后端 RSA 公钥（统一 axios） —— //
let _cachedPem: string | null = null
let _rsaKey: CryptoKey | null = null

async function fetchServerPubKey(): Promise<string | null> {
  try {
    // http 的 baseURL 已是 /api，这里用相对路径
    const resp = await http.get('/crypto/pubkey', { params: { t: Date.now() } })
    const data = (resp as any)?.data ?? resp
    const pem = data?.data?.pem || data?.pem
    return typeof pem === 'string' ? pem : null
  } catch {
    return null
  }
}

// —— WebCrypto RSA-OAEP-256 —— //
async function importRsaKeyWebCrypto(pem: string): Promise<CryptoKey> {
  const b64key = pem.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '')
  const raw = atob(b64key)
  const derU8 = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) derU8[i] = raw.charCodeAt(i)
  // ✅ 统一传 ArrayBuffer
  return crypto.subtle.importKey('spki', u8ToArrayBuffer(derU8), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, [
    'encrypt',
  ])
}

async function encryptWebCrypto(payload: unknown, pem: string): Promise<{ enc: string; alg: string } | null> {
  try {
    if (!_rsaKey) _rsaKey = await importRsaKeyWebCrypto(pem)
    const dataU8 = new TextEncoder().encode(JSON.stringify(payload))
    const ct = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, _rsaKey!, u8ToArrayBuffer(dataU8))
    return { enc: b64(ct), alg: 'RSA-OAEP-256' }
  } catch {
    return null
  }
}

// —— node-forge 回退（HTTP/非安全上下文可用） —— //
let _forge: any = null
async function getForge(): Promise<any> {
  _forge = _forge || (await import('node-forge'))
  return _forge
}

async function encryptForge(payload: unknown, pem: string): Promise<{ enc: string; alg: string } | null> {
  try {
    const forge = await getForge()
    const { pki, util, md } = forge
    const pub = pki.publicKeyFromPem(pem) as any
    const bytes = new TextEncoder().encode(JSON.stringify(payload))
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    const encrypted = pub.encrypt(bin, 'RSA-OAEP', { md: md.sha256.create() })
    return { enc: util.encode64(encrypted), alg: 'RSA-OAEP-256' }
  } catch {
    return null
  }
}

/**
 * 远端加密：统一在明文中自动注入 { ts, nonce }（ts: 毫秒）
 */
export async function tryEncryptRemote(jsonPayload: any): Promise<{ enc: string; alg: string } | null> {
  _cachedPem = _cachedPem || (await fetchServerPubKey())
  if (!_cachedPem) return null

  const wrapped = {
    ...(jsonPayload || {}),
    ts: Date.now(),
    nonce: randNonce(12),
  }

  if (hasSubtle) {
    const a = await encryptWebCrypto(wrapped, _cachedPem)
    if (a) return a
  }
  return encryptForge(wrapped, _cachedPem)
}
