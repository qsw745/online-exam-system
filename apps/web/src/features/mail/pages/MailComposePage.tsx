import { App, Button, Card, Form, Input, Space, Typography } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AttachmentUploader, {
  type NotificationAttachment,
} from '@/features/notifications-manager/components/AttachmentUploader'
import RecipientSelect from '@/features/mail/components/RecipientSelect'
import RichTextEditor from '@/features/mail/components/RichTextEditor'
import { mailApi } from '@/shared/api/endpoints/mail'

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
        message.error(error?.message || '加载草稿失败')
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
      message.success('草稿已保存')
    } catch (error: any) {
      message.error(error?.message || '保存草稿失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSend = async () => {
    try {
      await form.validateFields(['recipients', 'subject'])
      if (!content || !content.replace(/<[^>]+>/g, '').trim()) {
        message.warning('请填写邮件正文')
        return
      }
      setSending(true)
      const payload = buildPayload()
      await mailApi.send({ ...payload, draftId: draftId ?? undefined })
      lastSnapshotRef.current = buildSnapshot()
      message.success('邮件发送成功')
      navigate('/mail/sent')
    } catch (error: any) {
      if (error?.errorFields) return
      message.error(error?.message || '发送失败')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card
      title="撰写邮件"
      extra={
        <Space>
          <Typography.Text type="secondary">
            {autoSaving
              ? '正在自动保存...'
              : lastAutoSavedAt
              ? `自动保存：${lastAutoSavedAt.toLocaleTimeString()}`
              : ''}
          </Typography.Text>
          <Button onClick={handleSaveDraft} loading={saving}>
            保存草稿
          </Button>
          <Button type="primary" onClick={handleSend} loading={sending}>
            发送
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={{ recipients: [], attachments: [] }}>
        <Form.Item name="recipients" label="收件人"   rules={[{ required: true, message: '请选择收件人' }]}>
          <RecipientSelect  placeholder="搜索姓名/用户名/邮箱" />
        </Form.Item>
        <Form.Item name="subject" label="主题" rules={[{ required: true, message: '请输入主题' }]}>
          <Input placeholder="请输入邮件主题" />
        </Form.Item>
        <Form.Item label="正文">
          <RichTextEditor value={content} onChange={setContent} />
        </Form.Item>
        <Form.Item name="attachments" label="附件">
          <AttachmentUploader />
        </Form.Item>
      </Form>
    </Card>
  )
}
