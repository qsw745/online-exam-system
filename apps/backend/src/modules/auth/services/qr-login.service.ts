import { redis } from '@/common/redis/client'
import { FaceLoginService, type FaceVerifyReason } from './face-login.service'

const TTL_SEC = 180 // 二维码有效期 3 分钟
const keyOf = (ticketId: string) => `qr:login:${ticketId}`

type TicketStatus = 'pending' | 'scanned' | 'confirmed'

type Ticket = {
  email: string // 可为空：空则手机端走 1:N 识别
  status: TicketStatus
  pollToken: string
  persist: boolean
  matchedUserId?: number
  matchedEmail?: string // 1:N 识别到的账号邮箱
}

function uuid(): string {
  return (globalThis.crypto?.randomUUID?.() as string) || Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function maskEmail(email: string): string {
  const [name, domain] = email.split('@')
  if (!domain) return email
  const head = name.slice(0, Math.min(2, name.length))
  return `${head}***@${domain}`
}

async function read(ticketId: string): Promise<Ticket | null> {
  const raw = await redis.get(keyOf(ticketId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as Ticket
  } catch {
    return null
  }
}

async function write(ticketId: string, ticket: Ticket): Promise<void> {
  await redis.set(keyOf(ticketId), JSON.stringify(ticket), 'EX', TTL_SEC)
}

export class QrLoginService {
  /** PC 端出票：返回 ticketId + pollToken（pollToken 只回 PC，不进二维码） */
  static async create(email: string, persist: boolean) {
    const ticketId = uuid()
    const pollToken = uuid()
    await write(ticketId, { email: email.trim(), status: 'pending', pollToken, persist })
    return { ticketId, pollToken, expiresIn: TTL_SEC }
  }

  /** 手机打开二维码页：标记已扫描，返回账号脱敏提示 */
  static async info(ticketId: string) {
    const ticket = await read(ticketId)
    if (!ticket) return { status: 'expired' as const }
    if (ticket.status === 'pending') {
      ticket.status = 'scanned'
      await write(ticketId, ticket)
    }
    return { status: ticket.status, emailHint: maskEmail(ticket.email) }
  }

  /** 手机端刷脸授权：对票据绑定的账号做 1:1 比对，通过则置 confirmed */
  static async authorize(
    ticketId: string,
    images: string[]
  ): Promise<{ ok: true } | { ok: false; reason: FaceVerifyReason | 'expired' }> {
    const ticket = await read(ticketId)
    if (!ticket) return { ok: false, reason: 'expired' }

    // 票据绑定了邮箱 → 1:1 验证；否则 → 1:N 直接刷脸识别
    const result = ticket.email
      ? await FaceLoginService.verify(ticket.email, images)
      : await FaceLoginService.identify(images)
    if (!result.matched) return { ok: false, reason: result.reason }

    ticket.status = 'confirmed'
    ticket.matchedUserId = result.userId
    ticket.matchedEmail = result.email
    await write(ticketId, ticket)
    return { ok: true }
  }

  /**
   * PC 轮询：校验 pollToken。confirmed 时返回绑定邮箱并消费票据（单次），
   * 由控制器据此签发会话。
   */
  static async poll(
    ticketId: string,
    pollToken: string
  ): Promise<
    | { status: 'pending' | 'scanned' | 'expired' | 'invalid' }
    | { status: 'confirmed'; email: string; persist: boolean }
  > {
    const ticket = await read(ticketId)
    if (!ticket) return { status: 'expired' }
    if (ticket.pollToken !== pollToken) return { status: 'invalid' }
    if (ticket.status !== 'confirmed') return { status: ticket.status }

    // 单次消费：确认后立即删除，避免二次使用
    await redis.del(keyOf(ticketId))
    return { status: 'confirmed', email: ticket.matchedEmail || ticket.email, persist: ticket.persist }
  }
}
