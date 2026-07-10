import { redis } from '@/common/redis/client'
import { FaceLoginService, type FaceMatchCandidate, type FaceVerifyFailureReason } from './face-login.service'

const TTL_SEC = 180 // 二维码有效期 3 分钟
const keyOf = (ticketId: string) => `qr:login:${ticketId}`

type TicketStatus = 'pending' | 'scanned' | 'confirmed'

type QrFaceChoice = {
  choiceId: string
  userId: number
  email: string
  displayName: string
  maskedEmail: string
  role: string | null
  similarity: number
}

type Ticket = {
  status: TicketStatus
  pollToken: string
  persist: boolean
  matchedUserId?: number
  matchedEmail?: string
  candidates?: QrFaceChoice[]
}

function uuid(): string {
  return (globalThis.crypto?.randomUUID?.() as string) || Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function maskEmail(email: string) {
  const [name, domain] = String(email || '').split('@')
  if (!domain) return email
  const head = name.slice(0, Math.min(2, name.length))
  return `${head}${name.length > 2 ? '***' : '*'}@${domain}`
}

function displayNameOf(candidate: FaceMatchCandidate) {
  return candidate.nickname || candidate.username || candidate.email.split('@')[0] || `用户 ${candidate.userId}`
}

function toChoices(candidates: FaceMatchCandidate[]): QrFaceChoice[] {
  return candidates.map(candidate => ({
    choiceId: uuid(),
    userId: candidate.userId,
    email: candidate.email,
    displayName: displayNameOf(candidate),
    maskedEmail: maskEmail(candidate.email),
    role: candidate.role,
    similarity: candidate.similarity,
  }))
}

function publicChoices(choices: QrFaceChoice[]) {
  return choices.map(({ choiceId, displayName, maskedEmail, role }) => ({
    choiceId,
    displayName,
    maskedEmail,
    role,
  }))
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
  static async create(persist: boolean) {
    const ticketId = uuid()
    const pollToken = uuid()
    await write(ticketId, { status: 'pending', pollToken, persist })
    return { ticketId, pollToken, expiresIn: TTL_SEC }
  }

  /** 手机打开二维码页：标记已扫描 */
  static async info(ticketId: string) {
    const ticket = await read(ticketId)
    if (!ticket) return { status: 'expired' as const }
    if (ticket.status === 'pending') {
      ticket.status = 'scanned'
      await write(ticketId, ticket)
    }
    return { status: ticket.status }
  }

  /** 手机端刷脸授权：按人脸识别出的账号置 confirmed */
  static async authorize(
    ticketId: string,
    images: string[]
  ): Promise<
    | { ok: true }
    | { ok: false; reason: FaceVerifyFailureReason | 'multiple_matches' | 'expired'; candidates?: ReturnType<typeof publicChoices> }
  > {
    const ticket = await read(ticketId)
    if (!ticket) return { ok: false, reason: 'expired' }

    const result = await FaceLoginService.identify(images, { allowMultipleMatches: true })
    if (!result.matched) {
      if (result.reason === 'multiple_matches') {
        const choices = toChoices(result.candidates)
        ticket.status = 'scanned'
        ticket.candidates = choices
        await write(ticketId, ticket)
        return { ok: false, reason: result.reason, candidates: publicChoices(choices) }
      }
      return { ok: false, reason: result.reason }
    }

    ticket.status = 'confirmed'
    ticket.matchedUserId = result.userId
    ticket.matchedEmail = result.email
    await write(ticketId, ticket)
    return { ok: true }
  }

  static async select(
    ticketId: string,
    choiceId: string
  ): Promise<{ ok: true } | { ok: false; reason: 'expired' | 'invalid_choice' }> {
    const ticket = await read(ticketId)
    if (!ticket) return { ok: false, reason: 'expired' }
    const selected = ticket.candidates?.find(item => item.choiceId === choiceId)
    if (!selected) return { ok: false, reason: 'invalid_choice' }

    ticket.status = 'confirmed'
    ticket.matchedUserId = selected.userId
    ticket.matchedEmail = selected.email
    await write(ticketId, ticket)
    return { ok: true }
  }

  /**
   * PC 主动作废票据（重新生成二维码/关闭弹窗时调用），校验 pollToken 防止他人作废。
   * 作废后手机端在旧页面重试会得到 expired，避免"手机显示成功但 PC 已换票"的错位。
   */
  static async cancel(ticketId: string, pollToken: string): Promise<void> {
    const ticket = await read(ticketId)
    if (!ticket || ticket.pollToken !== pollToken) return
    await redis.del(keyOf(ticketId))
  }

  /**
   * PC 轮询：校验 pollToken。confirmed 时返回识别到的邮箱并消费票据（单次），
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
    if (!ticket.matchedEmail) return { status: 'expired' }
    return { status: 'confirmed', email: ticket.matchedEmail, persist: ticket.persist }
  }
}
