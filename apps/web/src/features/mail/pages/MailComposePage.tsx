import { App, Button, Card, Form, Input, Space, Typography } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AttachmentUploader, {
  type NotificationAttachment,
} from '@/features/notifications-manager/components/AttachmentUploader'
import RecipientSelect from '@/features/mail/components/RecipientSelect'
import RichTextEditor from '@/features/mail/components/RichTextEditor'
import { mailApi } from '@/shared/api/endpoints/mail'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

type ComposeFormValues = {
  recipients: number[]
  subject: string
  attachments: NotificationAttachment[]
}

export default function MailComposePage() {
  const { message } = App.useApp()
  const [form] = Form.useForm<ComposeFormValues>()
  const [content, setContent] = useState('<p></p>')
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [draftId, setDraftId] = useState<number | null>(null)
  const [autoSaving, setAutoSaving] = useState(false)
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<Date | null>(null)
  const autoSaveTimer = useRef<number | null>(null)
  const lastSnapshotRef = useRef<string>('')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const recipients = (Form.useWatch('recipients', form) as number[]) || []
  const subjectValue = Form.useWatch('subject', form) || ''
  const attachmentsValue = (Form.useWatch('attachments', form) as NotificationAttachment[]) || []
  const recipientsKey = recipients.join(',')
  const attachmentsKey = attachmentsValue.map(att => `${att.id ?? ''}:${att.file_name ?? ''}`).join('|')

  const draftIdFromQuery = useMemo(() => {
    const raw = searchParams.get('draftId')
    if (!raw) return null
    const num = Number(raw)
    return Number.isNaN(num) ? null : num
  }, [searchParams])

  useEffect(() => {
    if (!draftIdFromQuery) return
    ;(async () => {
      try {
        const detail = await mailApi.detail(draftIdFromQuery)
        form.setFieldsValue({
          subject: detail.subject,
          recipients: detail.recipients.map(r => r.id),
          attachments: detail.attachments as unknown as NotificationAttachment[],
        })
        setContent(detail.content)
        setDraftId(detail.id)
      } catch (error: any) {
        message.error(error?.message || translate('auto.816e498ddc'))
      }
    })()
  }, [draftIdFromQuery, form, message])

  const buildPayload = () => ({
    id: draftId ?? undefined,
    subject: subjectValue,
    content,
    recipients,
    attachments: attachmentsValue as NotificationAttachment[],
  })

  const getPlainText = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
  const hasMeaningfulInput = () =>
    Boolean(
      subjectValue.trim() ||
        recipients.length ||
        attachmentsValue.length ||
        getPlainText(content).length
    )

  const buildSnapshot = () =>
    JSON.stringify({
      subject: subjectValue,
      recipients,
      attachments: attachmentsValue,
      content,
    })

  useEffect(() => {
    if (autoSaveTimer.current) {
      window.clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = null
    }
    if (!hasMeaningfulInput() || sending) return

    autoSaveTimer.current = window.setTimeout(async () => {
      const snapshot = buildSnapshot()
      if (snapshot === lastSnapshotRef.current) return
      try {
        setAutoSaving(true)
        const payload = buildPayload()
        const saved = await mailApi.saveDraft(payload)
        setDraftId(saved.id)
        lastSnapshotRef.current = snapshot
        setLastAutoSavedAt(new Date())
      } catch (error) {
        console.error('auto save draft failed', error)
      } finally {
        setAutoSaving(false)
      }
    }, 3000)

    return () => {
      if (autoSaveTimer.current) {
        window.clearTimeout(autoSaveTimer.current)
        autoSaveTimer.current = null
      }
    }
  }, [subjectValue, content, recipientsKey, attachmentsKey, sending])

  const handleSaveDraft = async () => {
    try {
      setSaving(true)
      const payload = buildPayload()
      const saved = await mailApi.saveDraft(payload)
      setDraftId(saved.id)
      lastSnapshotRef.current = buildSnapshot()
      setLastAutoSavedAt(new Date())
      message.success(translate('auto.9d84cfe84d'))
    } catch (error: any) {
      message.error(error?.message || translate('auto.d90c726dc7'))
    } finally {
      setSaving(false)
    }
  }

  const handleSend = async () => {
    try {
      await form.validateFields(['recipients', 'subject'])
      if (!content || !content.replace(/<[^>]+>/g, '').trim()) {
        message.warning(translate('auto.10da346646'))
        return
      }
      setSending(true)
      const payload = buildPayload()
      await mailApi.send({ ...payload, draftId: draftId ?? undefined })
      lastSnapshotRef.current = buildSnapshot()
      message.success(translate('auto.0c7c05ad53'))
      navigate('/mail/sent')
    } catch (error: any) {
      if (error?.errorFields) return
      message.error(error?.message || translate('auto.e767d34c78'))
    } finally {
      setSending(false)
    }
  }

  return (
    <Card
      title={translate('auto.69866426e7')}
      extra={
        <Space>
          <Typography.Text type="secondary">
            {autoSaving
              ? translate('visible.86b1195aed')
              : lastAutoSavedAt
              ? `${translate('mail.auto_saved_at')}${formatDateTime(lastAutoSavedAt)}`
              : ''}
          </Typography.Text>
          <Button onClick={handleSaveDraft} loading={saving}>
            {translate('auto.4cd30ef91e')}</Button>
          <Button type="primary" onClick={handleSend} loading={sending}>
            {translate('aiAssistant.send')}</Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={{ recipients: [], attachments: [] }}>
        <Form.Item name="recipients" label={translate('auto.529414cfe5')}   rules={[{ required: true, message: translate('auto.5e45a0565d') }]}>
          <RecipientSelect  placeholder={translate('auto.9070d7a254')} />
        </Form.Item>
        <Form.Item name="subject" label={translate('settings.theme')} rules={[{ required: true, message: translate('auto.da72d90e60') }]}>
          <Input placeholder={translate('auto.5ce6c87094')} />
        </Form.Item>
        <Form.Item label={translate('richTextEditor.format.body')}>
          <RichTextEditor value={content} onChange={setContent} />
        </Form.Item>
        <Form.Item name="attachments" label={translate('auto.99f6fe6c41')}>
          <AttachmentUploader />
        </Form.Item>
      </Form>
    </Card>
  )
}
