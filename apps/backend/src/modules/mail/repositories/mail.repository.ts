import { pool } from '@/config/database'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type {
  MailAttachment,
  MailInboxItem,
  MailMessage,
  MailRecipientOption,
  MailRecipientSnapshot,
} from '../domain/mail.types'

type Queryable = {
  query<T = any>(sql: string, params?: any[]): Promise<[T, any]>
}

const db: Queryable = pool as unknown as Queryable

const parseJson = <T>(value: any, fallback: T): T => {
  if (!value) return fallback
  if (Array.isArray(value)) return value as T
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed ?? fallback
    } catch {
      return fallback
    }
  }
  return fallback
}

const normalizeName = (row: any) => row?.nickname || row?.username || row?.email || `用户${row?.id || ''}`

const parseActiveRecipientIds = (value: any): Set<number> | null => {
  if (!value) return null
  if (Array.isArray(value)) {
    const ids = value.map((v: any) => Number(v)).filter(n => Number.isFinite(n))
    return new Set(ids)
  }
  if (typeof value === 'string') {
    const ids = value
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => Number.isFinite(n))
    return ids.length ? new Set(ids) : null
  }
  return null
}

const mapMessageRow = (row: any): MailMessage => {
  const attachments = parseJson<MailAttachment[]>(row.attachments, [])
  const activeIds = parseActiveRecipientIds(row.active_recipient_ids)
  const recipients = parseJson<MailRecipientSnapshot[]>(row.recipients_snapshot, []).map(rec => ({
    ...rec,
    status: activeIds ? (activeIds.has(Number(rec.id)) ? 'delivered' : 'recalled') : rec.status,
  }))
  return {
    id: Number(row.id),
    subject: row.subject || '',
    content: row.content || '',
    sender_id: Number(row.sender_id),
    sender_name: row.sender_name || row.sender?.nickname || row.username || row.nickname || null,
    status: row.status as MailMessage['status'],
    sent_at: row.sent_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    attachments,
    recipients,
  }
}

export class MailRepository {
  static async insertMessage(payload: {
    subject: string
    content: string
    sender_id: number
    status: 'draft' | 'sent'
    attachments?: MailAttachment[]
    recipients?: MailRecipientSnapshot[]
    sent_at?: Date | null
  }): Promise<number> {
    const [ret] = await db.query<ResultSetHeader>(
      `INSERT INTO mail_messages (subject, content, sender_id, status, attachments, recipients_snapshot, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.subject,
        payload.content,
        payload.sender_id,
        payload.status,
        payload.attachments ? JSON.stringify(payload.attachments) : null,
        payload.recipients ? JSON.stringify(payload.recipients) : null,
        payload.sent_at ?? null,
      ]
    )
    return ret.insertId
  }

  static async updateMessage(
    id: number,
    payload: Partial<{
      subject: string
      content: string
      status: 'draft' | 'sent'
      attachments: MailAttachment[]
      recipients: MailRecipientSnapshot[]
      sent_at: Date | null
    }>
  ) {
    const sets: string[] = []
    const vals: any[] = []
    if (payload.subject !== undefined) {
      sets.push('subject = ?')
      vals.push(payload.subject)
    }
    if (payload.content !== undefined) {
      sets.push('content = ?')
      vals.push(payload.content)
    }
    if (payload.status !== undefined) {
      sets.push('status = ?')
      vals.push(payload.status)
    }
    if (payload.attachments !== undefined) {
      sets.push('attachments = ?')
      vals.push(payload.attachments ? JSON.stringify(payload.attachments) : null)
    }
    if (payload.recipients !== undefined) {
      sets.push('recipients_snapshot = ?')
      vals.push(payload.recipients ? JSON.stringify(payload.recipients) : null)
    }
    if (payload.sent_at !== undefined) {
      sets.push('sent_at = ?')
      vals.push(payload.sent_at)
    }
    if (!sets.length) return
    await db.query<ResultSetHeader>(
      `UPDATE mail_messages SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`,
      [...vals, id]
    )
  }

  static async getMessageById(id: number): Promise<MailMessage | null> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT m.*, u.username, u.nickname,
              (SELECT GROUP_CONCAT(mr.recipient_id) FROM mail_recipients mr WHERE mr.message_id = m.id) AS active_recipient_ids
       FROM mail_messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.id = ?`,
      [id]
    )
    const row = (rows as any[])[0]
    return row ? mapMessageRow({ ...row, sender_name: normalizeName(row) }) : null
  }

  static async listInbox(userId: number): Promise<MailInboxItem[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT mr.id AS receipt_id, mr.is_read, mr.recipient_id, mr.read_at, m.*, 
              s.username AS sender_username, s.nickname AS sender_nickname,
              (SELECT GROUP_CONCAT(inner_mr.recipient_id) 
                 FROM mail_recipients inner_mr 
                WHERE inner_mr.message_id = m.id) AS active_recipient_ids
       FROM mail_recipients mr
       JOIN mail_messages m ON m.id = mr.message_id
       LEFT JOIN users s ON s.id = m.sender_id
       WHERE mr.recipient_id = ?
       ORDER BY COALESCE(m.sent_at, mr.created_at, m.created_at) DESC`,
      [userId]
    )
    return rows.map(row => {
      const base = mapMessageRow({
        ...row,
        sender_name: row.sender_nickname || row.sender_username,
      })
      return {
        ...base,
        receipt_id: Number((row as any).receipt_id),
        is_read: Boolean((row as any).is_read),
        recipient_id: Number((row as any).recipient_id),
        read_at: row.read_at ?? null,
      }
    })
  }

  static async listSent(userId: number): Promise<MailMessage[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT m.*, u.username, u.nickname,
              (SELECT GROUP_CONCAT(mr.recipient_id) FROM mail_recipients mr WHERE mr.message_id = m.id) AS active_recipient_ids
       FROM mail_messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.sender_id = ? AND m.status = 'sent'
       ORDER BY COALESCE(m.sent_at, m.updated_at, m.created_at) DESC`,
      [userId]
    )
    return rows.map(row => mapMessageRow({ ...row, sender_name: normalizeName(row) }))
  }

  static async listDrafts(userId: number): Promise<MailMessage[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT m.*, u.username, u.nickname,
              (SELECT GROUP_CONCAT(mr.recipient_id) FROM mail_recipients mr WHERE mr.message_id = m.id) AS active_recipient_ids
       FROM mail_messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.sender_id = ? AND m.status = 'draft'
       ORDER BY m.updated_at DESC`,
      [userId]
    )
    return rows.map(row => mapMessageRow({ ...row, sender_name: normalizeName(row) }))
  }

  static async replaceRecipients(messageId: number, recipientIds: number[]) {
    await db.query<ResultSetHeader>('DELETE FROM mail_recipients WHERE message_id = ?', [messageId])
    if (!recipientIds.length) return
    const placeholders = recipientIds.map(() => '(?, ?)').join(', ')
    const flat = recipientIds.flatMap(id => [messageId, id])
    await db.query<ResultSetHeader>(
      `INSERT INTO mail_recipients (message_id, recipient_id) VALUES ${placeholders}`,
      flat
    )
  }

  static async markRecipientRead(messageId: number, recipientId: number) {
    const [ret] = await db.query<ResultSetHeader>(
      `UPDATE mail_recipients 
         SET is_read = true, read_at = NOW() 
       WHERE message_id = ? AND recipient_id = ?`,
      [messageId, recipientId]
    )
    return ret.affectedRows > 0
  }

  static async deleteRecipient(messageId: number, recipientId: number) {
    const [ret] = await db.query<ResultSetHeader>(
      `DELETE FROM mail_recipients WHERE message_id = ? AND recipient_id = ?`,
      [messageId, recipientId]
    )
    return ret.affectedRows > 0
  }

  static async deleteBySender(id: number, senderId: number) {
    const [ret] = await db.query<ResultSetHeader>(`DELETE FROM mail_messages WHERE id = ? AND sender_id = ?`, [
      id,
      senderId,
    ])
    return ret.affectedRows > 0
  }

  static async recallRecipients(messageId: number, senderId: number, recipientIds: number[]) {
    if (!recipientIds.length) return { ok: false, reason: 'empty' }
    const [ownerRows] = await db.query<RowDataPacket[]>(`SELECT id FROM mail_messages WHERE id = ? AND sender_id = ?`, [
      messageId,
      senderId,
    ])
    if (!ownerRows.length) return { ok: false, reason: 'not_owner' }
    const placeholders = recipientIds.map(() => '?').join(', ')
    const [ret] = await db.query<ResultSetHeader>(
      `DELETE FROM mail_recipients WHERE message_id = ? AND recipient_id IN (${placeholders})`,
      [messageId, ...recipientIds]
    )
    if (!ret.affectedRows) return { ok: false, reason: 'recipient_missing' }
    const [countRows] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS cnt FROM mail_recipients WHERE message_id = ?`, [
      messageId,
    ])
    const remaining = Number((countRows[0] as any)?.cnt ?? 0)
    if (remaining === 0) {
      await db.query<ResultSetHeader>(
        `UPDATE mail_messages SET status = 'recalled', updated_at = NOW() WHERE id = ?`,
        [messageId]
      )
    }
    return { ok: true, remaining, removed: ret.affectedRows }
  }

  static async deleteRecipient(messageId: number, recipientId: number) {
    const [ret] = await db.query<ResultSetHeader>(
      `DELETE FROM mail_recipients WHERE message_id = ? AND recipient_id = ?`,
      [messageId, recipientId]
    )
    return ret.affectedRows > 0
  }

  static async deleteBySender(id: number, senderId: number) {
    const [ret] = await db.query<ResultSetHeader>(`DELETE FROM mail_messages WHERE id = ? AND sender_id = ?`, [
      id,
      senderId,
    ])
    return ret.affectedRows > 0
  }

  static async recallMessage(id: number, senderId: number) {
    const [ret] = await db.query<ResultSetHeader>(
      `UPDATE mail_messages 
         SET status = 'recalled', updated_at = NOW() 
       WHERE id = ? AND sender_id = ? AND status = 'sent'`,
      [id, senderId]
    )
    if (ret.affectedRows > 0) {
      await db.query<ResultSetHeader>('DELETE FROM mail_recipients WHERE message_id = ?', [id])
      return true
    }
    return false
  }

  static async findMessageForUser(id: number, userId: number): Promise<MailInboxItem | MailMessage | null> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT m.*, u.username, u.nickname,
              mr.id AS receipt_id, mr.is_read, mr.recipient_id, mr.read_at,
              (SELECT GROUP_CONCAT(inner_mr.recipient_id) FROM mail_recipients inner_mr WHERE inner_mr.message_id = m.id) AS active_recipient_ids
         FROM mail_messages m
         LEFT JOIN users u ON u.id = m.sender_id
         LEFT JOIN mail_recipients mr ON mr.message_id = m.id AND mr.recipient_id = ?
        WHERE m.id = ?`,
      [userId, id]
    )
    const row = rows[0]
    if (!row) return null
    const base = mapMessageRow({ ...row, sender_name: normalizeName(row) })
    if (row.recipient_id) {
      return {
        ...base,
        receipt_id: Number(row.receipt_id),
        is_read: Boolean(row.is_read),
        recipient_id: Number(row.recipient_id),
        read_at: row.read_at ?? null,
      }
    }
    if (base.sender_id === userId) return base
    return null
  }

  static async searchRecipients(keyword: string, limit = 20): Promise<MailRecipientOption[]> {
    const like = `%${keyword}%`
    const params: any[] = keyword ? [like, like, like, limit] : [limit]
    const sql = keyword
      ? `SELECT id, username, nickname, email 
           FROM users 
          WHERE username LIKE ? OR nickname LIKE ? OR email LIKE ? 
          ORDER BY updated_at DESC 
          LIMIT ?`
      : `SELECT id, username, nickname, email 
           FROM users 
          ORDER BY updated_at DESC 
          LIMIT ?`
    const [rows] = await db.query<RowDataPacket[]>(sql, params)
    return rows.map(row => ({
      id: Number(row.id),
      name: normalizeName(row),
      email: row.email || null,
    }))
  }

  static async findUsersByIds(ids: number[]): Promise<MailRecipientOption[]> {
    if (!ids.length) return []
    const placeholders = ids.map(() => '?').join(', ')
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT id, username, nickname, email FROM users WHERE id IN (${placeholders})`,
      ids
    )
    return rows.map(row => ({
      id: Number(row.id),
      name: normalizeName(row),
      email: row.email || null,
    }))
  }
}
