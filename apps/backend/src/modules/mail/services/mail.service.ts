import HttpError from '@/common/errors/http-error'
import type { MailComposePayload, MailInboxItem, MailMessage, MailRecipientOption } from '../domain/mail.types'
import { MailRepository } from '../repositories/mail.repository'
import { emailService } from '@/infrastructure/email/email.service'

const ensureSubject = (subject?: string) => (subject ?? '').trim()
const ensureContent = (content?: string) => (content ?? '').trim()

const ensureRecipientSnapshots = async (ids: number[]) => {
  if (!ids?.length) return []
  const unique = Array.from(new Set(ids.filter(id => Number.isInteger(id) && id > 0)))
  if (!unique.length) return []
  const users = await MailRepository.findUsersByIds(unique)
  return users.map(u => ({ id: u.id, name: u.name }))
}

export class MailService {
  static async getInbox(userId: number): Promise<MailInboxItem[]> {
    return MailRepository.listInbox(userId)
  }

  static async getSent(userId: number): Promise<MailMessage[]> {
    return MailRepository.listSent(userId)
  }

  static async getDrafts(userId: number): Promise<MailMessage[]> {
    return MailRepository.listDrafts(userId)
  }

  static async getDetail(userId: number, id: number): Promise<MailMessage | MailInboxItem> {
    const data = await MailRepository.findMessageForUser(id, userId)
    if (!data) throw HttpError.notFound('邮件不存在或无权访问')
    return data
  }

  static async saveDraft(userId: number, payload: MailComposePayload): Promise<MailMessage> {
    const subject = ensureSubject(payload.subject)
    const content = payload.content ?? ''
    const attachments = payload.attachments ?? []
    const recipientSnapshots = await ensureRecipientSnapshots(payload.recipients ?? [])

    if (payload.id) {
      const existing = await MailRepository.getMessageById(payload.id)
      if (!existing || existing.sender_id !== userId) throw HttpError.notFound('草稿不存在')
      await MailRepository.updateMessage(payload.id, {
        subject,
        content,
        attachments,
        recipients: recipientSnapshots,
        status: 'draft',
        sent_at: null,
      })
      return (await MailRepository.getMessageById(payload.id))!
    }

    const id = await MailRepository.insertMessage({
      subject,
      content,
      sender_id: userId,
      status: 'draft',
      attachments,
      recipients: recipientSnapshots,
      sent_at: null,
    })
    return (await MailRepository.getMessageById(id))!
  }

  static async send(userId: number, payload: MailComposePayload & { draftId?: number }): Promise<MailMessage> {
    const subject = ensureSubject(payload.subject)
    const content = ensureContent(payload.content)
    if (!subject) throw HttpError.badRequest('请填写邮件主题')
    if (!content) throw HttpError.badRequest('请填写邮件正文')
    const recipients = await ensureRecipientSnapshots(payload.recipients ?? [])
    if (!recipients.length) throw HttpError.badRequest('请选择至少一个收件人')
    const attachments = payload.attachments ?? []
    const sendAt = new Date()

    let messageId = payload.draftId ?? payload.id ?? null
    if (messageId) {
      const existing = await MailRepository.getMessageById(messageId)
      if (!existing || existing.sender_id !== userId) throw HttpError.notFound('草稿不存在')
      await MailRepository.updateMessage(messageId, {
        subject,
        content,
        status: 'sent',
        attachments,
        recipients,
        sent_at: sendAt,
      })
    } else {
      messageId = await MailRepository.insertMessage({
        subject,
        content,
        sender_id: userId,
        status: 'sent',
        attachments,
        recipients,
        sent_at: sendAt,
      })
    }

    await MailRepository.replaceRecipients(
      messageId,
      recipients.map(r => r.id)
    )
    if (payload.send_external) {
      const users = await MailRepository.findUsersByIds(recipients.map(r => r.id))
      const targets = users.map(u => u.email).filter((v): v is string => !!v)
      if (!targets.length) throw HttpError.badRequest('收件人邮箱为空')
      const results = await Promise.all(targets.map(to => emailService.sendPlainEmail(to, subject, content)))
      const failed = targets.filter((_, idx) => !results[idx])
      if (failed.length) throw HttpError.internal(`外部邮件发送失败: ${failed.join(',')}`)
    }
    return (await MailRepository.getMessageById(messageId))!
  }

  static async markRead(userId: number, id: number) {
    const data = await MailRepository.findMessageForUser(id, userId)
    if (!data || (data as MailMessage).sender_id === userId) {
      throw HttpError.notFound('邮件不存在')
    }
    await MailRepository.markRecipientRead(id, userId)
    return { success: true }
  }

  static async recipientOptions(keyword: string): Promise<MailRecipientOption[]> {
    return MailRepository.searchRecipients(keyword, 20)
  }

  static async deleteDraft(userId: number, id: number) {
    const msg = await MailRepository.getMessageById(id)
    if (!msg || msg.sender_id !== userId || msg.status !== 'draft') throw HttpError.notFound('草稿不存在')
    await MailRepository.deleteBySender(id, userId)
    return { success: true }
  }

  static async deleteSent(userId: number, id: number) {
    const msg = await MailRepository.getMessageById(id)
    if (!msg || msg.sender_id !== userId) throw HttpError.notFound('邮件不存在')
    await MailRepository.deleteBySender(id, userId)
    return { success: true }
  }

  static async recallSent(userId: number, id: number, recipientIds: number[]) {
    const validIds = Array.from(new Set(recipientIds.filter(v => Number.isInteger(v) && v > 0)))
    if (!validIds.length) throw HttpError.badRequest('请选择要撤回的收件人')
    const result = await MailRepository.recallRecipients(id, userId, validIds)
    if (!result.ok) throw HttpError.notFound('无法撤回这些收件人')
    return { success: true, remaining: result.remaining }
  }

  static async deleteInbox(userId: number, id: number) {
    const ok = await MailRepository.deleteRecipient(id, userId)
    if (!ok) throw HttpError.notFound('邮件不存在')
    return { success: true }
  }
}
