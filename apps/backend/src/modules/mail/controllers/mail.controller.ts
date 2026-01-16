import type { AuthRequest } from '@/types/auth.js'
import type { Res } from '@/types/response.js'
import { MailService } from '../services/mail.service.js'

const pickUserId = (req: AuthRequest) => req.user?.id

export class MailController {
  static async inbox(req: AuthRequest, res: Res) {
    const userId = pickUserId(req)
    if (!userId) return res.unauthorized('未授权')
    const data = await MailService.getInbox(userId)
    return res.ok(data)
  }

  static async sent(req: AuthRequest, res: Res) {
    const userId = pickUserId(req)
    if (!userId) return res.unauthorized('未授权')
    const data = await MailService.getSent(userId)
    return res.ok(data)
  }

  static async drafts(req: AuthRequest, res: Res) {
    const userId = pickUserId(req)
    if (!userId) return res.unauthorized('未授权')
    const data = await MailService.getDrafts(userId)
    return res.ok(data)
  }

  static async detail(req: AuthRequest, res: Res) {
    const userId = pickUserId(req)
    const id = Number(req.params.id)
    if (!userId) return res.unauthorized('未授权')
    if (Number.isNaN(id)) return res.badRequest('无效的邮件ID')
    const data = await MailService.getDetail(userId, id)
    return res.ok(data)
  }

  static async saveDraft(req: AuthRequest, res: Res) {
    const userId = pickUserId(req)
    if (!userId) return res.unauthorized('未授权')
    const payload = req.body ?? {}
    const saved = await MailService.saveDraft(userId, {
      id: payload.id,
      subject: payload.subject,
      content: payload.content,
      recipients: payload.recipients,
      attachments: payload.attachments,
    })
    return res.ok(saved, '草稿已保存')
  }

  static async send(req: AuthRequest, res: Res) {
    const userId = pickUserId(req)
    if (!userId) return res.unauthorized('未授权')
    const payload = req.body ?? {}
    const sent = await MailService.send(userId, {
      id: payload.id,
      draftId: payload.draftId,
      subject: payload.subject,
      content: payload.content,
      recipients: payload.recipients,
      attachments: payload.attachments,
      send_external: !!payload.send_external,
    })
    return res.ok(sent, '发送成功')
  }

  static async markRead(req: AuthRequest, res: Res) {
    const userId = pickUserId(req)
    const id = Number(req.params.id)
    if (!userId) return res.unauthorized('未授权')
    if (Number.isNaN(id)) return res.badRequest('无效的邮件ID')
    await MailService.markRead(userId, id)
    return res.ok({ success: true }, '已标记为已读')
  }

  static async recipientOptions(req: AuthRequest, res: Res) {
    const userId = pickUserId(req)
    if (!userId) return res.unauthorized('未授权')
    const keyword = String(req.query.q ?? '').trim()
    const list = await MailService.recipientOptions(keyword)
    return res.ok(list)
  }

  static async deleteInbox(req: AuthRequest, res: Res) {
    const userId = pickUserId(req)
    const id = Number(req.params.id)
    if (!userId) return res.unauthorized('未授权')
    if (Number.isNaN(id)) return res.badRequest('无效的邮件ID')
    await MailService.deleteInbox(userId, id)
    return res.ok({ success: true }, '删除成功')
  }

  static async deleteDraft(req: AuthRequest, res: Res) {
    const userId = pickUserId(req)
    const id = Number(req.params.id)
    if (!userId) return res.unauthorized('未授权')
    if (Number.isNaN(id)) return res.badRequest('无效的邮件ID')
    await MailService.deleteDraft(userId, id)
    return res.ok({ success: true }, '草稿已删除')
  }

  static async deleteSent(req: AuthRequest, res: Res) {
    const userId = pickUserId(req)
    const id = Number(req.params.id)
    if (!userId) return res.unauthorized('未授权')
    if (Number.isNaN(id)) return res.badRequest('无效的邮件ID')
    await MailService.deleteSent(userId, id)
    return res.ok({ success: true }, '删除成功')
  }

  static async recallSent(req: AuthRequest, res: Res) {
    const userId = pickUserId(req)
    const id = Number(req.params.id)
    const recipientIdsRaw = req.body?.recipient_ids
    if (!userId) return res.unauthorized('未授权')
    if (Number.isNaN(id)) return res.badRequest('无效的邮件ID')
    const recipientIds = Array.isArray(recipientIdsRaw) ? recipientIdsRaw.map(Number) : []
    await MailService.recallSent(userId, id, recipientIds)
    return res.ok({ success: true }, '邮件已撤回')
  }
}
