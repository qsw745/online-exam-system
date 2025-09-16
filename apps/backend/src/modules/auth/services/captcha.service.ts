// apps/backend/src/modules/auth/services/captcha.service.ts
import svgCaptcha from 'svg-captcha'

type Item = { code: string; exp: number }
const store = new Map<string, Item>()            // 简易内存存储
const TTL_MS = 3 * 60 * 1000                     // 3 分钟有效

function randId() {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}

export const CaptchaService = {
    create() {
        const { text, data } = svgCaptcha.create({
            width: 120,
            height: 44,
            size: 4,
            noise: 2,
            ignoreChars: '0oO1ilI',
            color: true,
            background: '#f6f7fb',
        })
        const id = randId()
        store.set(id, { code: text.toLowerCase(), exp: Date.now() + TTL_MS })
        return { id, svg: data, ttl: TTL_MS }
    },

    /** 一次性校验 */
    verify(id: string, input: string) {
        if (!id || !input) return false
        const rec = store.get(id)
        store.delete(id) // 一次性使用
        if (!rec) return false
        if (Date.now() > rec.exp) return false
        return rec.code === String(input).trim().toLowerCase()
    }
}
export default CaptchaService
