// apps/backend/src/utils/request-ip.ts
import type { Request } from 'express'

/** 去掉 IPv6 映射前缀/端口等，转成更干净的 IP 文本 */
function normalizeIp(raw?: string | string[] | null): string | undefined {
    if (!raw) return undefined
    const s = Array.isArray(raw) ? raw[0] : raw
    let ip = s.trim()
    if (!ip) return undefined

    // RFC 7239 Forwarded: for=...
    if (/for=/i.test(ip)) {
        const m = ip.match(/for=("?)(\[?([^\];"]+)\]?)(\1)/i)
        ip = m?.[2] || ip
    }

    // x-forwarded-for 可能有多个: "client, proxy1, proxy2"
    if (ip.includes(',')) ip = ip.split(',')[0].trim()

    // 去掉方括号/端口/IPv4-mapped IPv6
    ip = ip.replace(/^\[|]$/g, '')
    ip = ip.replace(/:([\d]+)$/, '')
    ip = ip.replace(/^::ffff:/i, '')

    return ip || undefined
}

/** 常见回环 */
function isLoopback(ip?: string) {
    return ip === '127.0.0.1' || ip === '::1'
}

/** 受信任代理下尽量解析出真实客户端 IP */
export function getClientIp(req: Request): string | undefined {
    const h = req.headers
    const candidates = [
        h['cf-connecting-ip'],
        h['true-client-ip'],
        h['x-real-ip'],
        h['x-forwarded-for'],
        h['x-client-ip'],
        h['forwarded'], // RFC 7239
    ]

    for (const c of candidates) {
        const ip = normalizeIp(c)
        if (ip && !isLoopback(ip)) return ip
    }

    // 退化
    const ip2 = normalizeIp((req as any).ip || req.socket?.remoteAddress || '')
    return ip2
}
