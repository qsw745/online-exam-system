import { generateKeyPairSync, privateDecrypt, constants } from 'crypto'

const pair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

export const CryptoService = {
    getPublicKey() {
        return { alg: 'RSA-OAEP-256', pem: pair.publicKey }
    },

    // enc: base64 字符串。解密后应该是 JSON：{ email, password, ts, nonce }
    // 允许 120 秒时间漂移，避免重放
    decryptLoginCred(enc: string) {
        const buf = Buffer.from(enc, 'base64')
        const plain = privateDecrypt(
            { key: pair.privateKey, oaepHash: 'sha256', padding: constants.RSA_PKCS1_OAEP_PADDING },
            buf
        )
        const obj = JSON.parse(plain.toString('utf8'))
        if (!obj || typeof obj !== 'object') throw new Error('解密失败')

        const ts = Number(obj.ts || 0)
        const skew = Math.abs(Date.now() - ts)
        if (!Number.isFinite(ts) || skew > 120000) {
            throw new Error('凭证已过期，请重试')
        }
        if (!obj.email || !obj.password) {
            throw new Error('凭证不完整')
        }
        return { email: String(obj.email), password: String(obj.password) }
    },
}
