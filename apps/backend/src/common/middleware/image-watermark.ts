/* eslint-disable @typescript-eslint/no-explicit-any */
// 服务端图片水印：uploads 下的图片出服务器前，把「请求者身份 + 时间」合成进像素。
// 与前端水印互补：前端可被改代码绕过，这里绕不过；泄露图可溯源到具体请求人。
import path from 'node:path'
import fs from 'node:fs'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { AdminSettingsService } from '@/modules/admin-settings/services/admin-settings.service.js'
import type { AuthRequest } from '@/types/auth'

const IMAGE_EXTS: Record<string, keyof typeof OUTPUT_FORMAT> = {
  '.png': 'png',
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.webp': 'webp',
}
const OUTPUT_FORMAT = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
} as const

// 头像用于界面展示，打水印会破坏 UI，跳过
const SKIP_PREFIXES = ['/avatars/']

const MAX_SOURCE_BYTES = 20 * 1024 * 1024 // 超大文件直接原样下发，避免占用内存

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
const formatNow = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return [0, 0, 0]
  const v = m[1]
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}

function resolveContent(template: string, user?: { username?: string; email?: string } | null): string {
  return template
    .replace(/\{name\}/g, user?.username || user?.email || '')
    .replace(/\{email\}/g, user?.email || '')
    .replace(/\{time\}/g, formatNow())
    .replace(/\|/g, '  ') // 服务端单行平铺，多行分隔符转空格
    .trim()
}

/** 生成整图尺寸的平铺水印 SVG（pattern 内旋转文字） */
function buildOverlaySvg(opts: {
  width: number
  height: number
  text: string
  fontSize: number
  rotate: number
  gap: number
  color: string
  opacity: number
}): Buffer {
  const { width, height, text, fontSize, rotate, gap, color, opacity } = opts
  const [r, g, b] = hexToRgb(color)
  // pattern 尺寸随内容与间距走：宽按估算文字宽 + gap，高按行高 + gap
  const estTextWidth = Math.max(1, Math.round(text.length * fontSize * 0.62))
  const tileW = estTextWidth + gap
  const tileH = fontSize + gap
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <pattern id="wm" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse" patternTransform="rotate(${rotate})">
      <text x="0" y="${fontSize}" font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, sans-serif"
        font-size="${fontSize}" fill="rgba(${r}, ${g}, ${b}, ${opacity})">${esc(text)}</text>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#wm)"/>
</svg>`
  return Buffer.from(svg)
}

/**
 * uploads 图片水印中间件：命中图片且服务端水印开启时合成输出，否则 next() 交给 express.static。
 */
export function imageWatermark(uploadsDir: string): RequestHandler {
  const root = path.resolve(uploadsDir)

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.method !== 'GET') return next()

      const urlPath = decodeURIComponent((req.path || '').split('?')[0])
      const ext = path.extname(urlPath).toLowerCase()
      const format = IMAGE_EXTS[ext]
      if (!format) return next()
      if (SKIP_PREFIXES.some(p => urlPath.startsWith(p))) return next()

      // 防路径穿越：解析后必须仍在 uploads 根内
      const filePath = path.resolve(root, `.${path.sep}${urlPath.replace(/^\/+/, '')}`)
      if (!filePath.startsWith(root + path.sep)) return next()
      const stat = await fs.promises.stat(filePath).catch(() => null)
      if (!stat?.isFile() || stat.size > MAX_SOURCE_BYTES) return next()

      const settings: any = await AdminSettingsService.getSafe()
      if (!settings?.watermarkEnabled || !settings?.watermarkServerEnabled) return next()

      const user = (req as AuthRequest).user
      const text = resolveContent(String(settings.watermarkContent || '{name} {time}'), user)
      if (!text) return next()

      const { default: sharp } = await import('sharp')
      const image = sharp(filePath, { failOn: 'none' })
      const meta = await image.metadata()
      const width = meta.width || 0
      const height = meta.height || 0
      if (!width || !height) return next()

      const overlay = buildOverlaySvg({
        width,
        height,
        text,
        fontSize: Math.max(10, Math.min(48, Number(settings.watermarkFontSize) || 14)),
        rotate: Math.max(-90, Math.min(90, Number(settings.watermarkRotate) ?? -22)),
        gap: Math.max(20, Math.min(400, Number(settings.watermarkGap) || 100)),
        color: /^#[0-9a-fA-F]{6}$/.test(String(settings.watermarkColor)) ? settings.watermarkColor : '#000000',
        opacity: Math.max(0.02, Math.min(1, Number(settings.watermarkOpacity) || 0.12)),
      })

      const out = await image.composite([{ input: overlay, top: 0, left: 0 }]).toFormat(format).toBuffer()

      res.set('Content-Type', OUTPUT_FORMAT[format])
      // 水印含请求者身份与时间，禁止共享缓存
      res.set('Cache-Control', 'private, no-store')
      return res.end(out)
    } catch (err) {
      // 水印失败不阻断访问，回落原图
      console.error('[image-watermark] 合成失败，回落原图:', (err as any)?.message)
      return next()
    }
  }
}
