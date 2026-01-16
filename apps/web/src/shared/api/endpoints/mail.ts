import { api } from '@/shared/api/http'
import { isSuccess, getErr, type ApiResult } from '@/shared/api/core/types'

export type MailStatus = 'draft' | 'sent' | 'recalled'

export type MailAttachment = {
  id: number
  file_name: string
  url: string
  file_size: number
  mime_type?: string | null
}

export type MailRecipient = {
  id: number
  name: string
  email?: string | null
  status?: 'delivered' | 'recalled'
}

export type MailMessage = {
  id: number
  subject: string
  content: string
  sender_id: number
  sender_name?: string | null
  status: MailStatus
  sent_at?: string | null
  created_at: string
  updated_at: string
  attachments: MailAttachment[]
  recipients: MailRecipient[]
  is_read?: boolean
  receipt_id?: number
  recipient_id?: number
}

const toArray = <T>(value: any, fallback: T[]): T[] => {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? (parsed as T[]) : fallback
    } catch {
      return fallback
    }
  }
  return fallback
}

const normalizeMessage = (raw: any): MailMessage => {
  const attachments = toArray<MailAttachment>(raw.attachments, [])
  const recipients = toArray<MailRecipient>(raw.recipients ?? raw.recipients_snapshot, [])
  return {
    id: raw.id,
    subject: raw.subject || '',
    content: raw.content || '',
    sender_id: raw.sender_id,
    sender_name: raw.sender_name,
    status: raw.status,
    sent_at: raw.sent_at ?? null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    attachments,
    recipients,
    is_read: raw.is_read,
    receipt_id: raw.receipt_id,
    recipient_id: raw.recipient_id,
  }
}

const unwrap = async <T>(promise: Promise<ApiResult<T>>): Promise<T> => {
  const resp = await promise
  if (isSuccess<T>(resp)) return resp.data
  throw new Error(getErr(resp, '请求失败'))
}

const listFetcher = async (path: string) => {
  const resp = await unwrap<any[]>(api.get(path))
  return (Array.isArray(resp) ? resp : []).map(normalizeMessage)
}

export type MailComposePayload = {
  id?: number
  draftId?: number
  subject?: string
  content?: string
  recipients?: number[]
  attachments?: MailAttachment[]
  send_external?: boolean
}

export type RecipientOption = { id: number; name: string; email?: string | null }

export const mailApi = {
  inbox: () => listFetcher('/mail/inbox'),
  sent: () => listFetcher('/mail/sent'),
  drafts: () => listFetcher('/mail/drafts'),
  detail: async (id: number) => {
    const resp = await unwrap<any>(api.get(`/mail/${id}`))
    return normalizeMessage(resp)
  },
  saveDraft: async (payload: MailComposePayload) => {
    const resp = await unwrap<any>(api.post('/mail/draft', payload))
    return normalizeMessage(resp)
  },
  send: async (payload: MailComposePayload) => {
    const resp = await unwrap<any>(api.post('/mail/send', payload))
    return normalizeMessage(resp)
  },
  markRead: (id: number) => unwrap(api.put(`/mail/${id}/read`)),
  deleteInbox: (id: number) => unwrap(api.delete(`/mail/inbox/${id}`)),
  deleteDraft: (id: number) => unwrap(api.delete(`/mail/drafts/${id}`)),
  deleteSent: (id: number) => unwrap(api.delete(`/mail/sent/${id}`)),
  recallSent: (id: number, recipientIds: number[]) =>
    unwrap<{ success: boolean; remaining: number }>(api.put(`/mail/sent/${id}/recall`, { recipient_ids: recipientIds })),
  recipientOptions: async (keyword: string) => {
    const resp = await unwrap<any[]>(api.get('/mail/recipients/options', { params: { q: keyword } }))
    return (Array.isArray(resp) ? resp : []) as RecipientOption[]
  },
}
