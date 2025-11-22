export type MailStatus = 'draft' | 'sent' | 'recalled'

export type MailAttachment = {
  id: number
  file_name: string
  url: string
  file_size: number
  mime_type?: string | null
}

export type MailRecipientSnapshot = {
  id: number
  name: string
  status?: 'delivered' | 'recalled'
}

export interface MailMessage {
  id: number
  subject: string
  content: string
  sender_id: number
  sender_name?: string | null
  status: MailStatus
  sent_at?: Date | null
  attachments?: MailAttachment[]
  recipients?: MailRecipientSnapshot[]
  created_at: Date
  updated_at: Date
}

export interface MailInboxItem extends MailMessage {
  receipt_id: number
  is_read: boolean
  recipient_id: number
  read_at?: Date | null
}

export type MailRecipientOption = {
  id: number
  name: string
  email?: string | null
}

export type MailComposePayload = {
  id?: number
  subject?: string
  content?: string
  recipients?: number[]
  attachments?: MailAttachment[]
}
