import { Drawer, Space, Typography, Divider, List, Tag, Spin } from 'antd'
import { useEffect, useState } from 'react'
import { mailApi, type MailMessage } from '@/shared/api/endpoints/mail'

type Props = {
  open: boolean
  messageId?: number
  mailbox: 'inbox' | 'sent' | 'drafts'
  onClose: () => void
  onRead?: () => void
}

export default function MailViewerDrawer({ open, messageId, mailbox, onClose, onRead }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<MailMessage | null>(null)

  useEffect(() => {
    if (!open || !messageId) return
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const detail = await mailApi.detail(messageId)
        if (!mounted) return
        setData(detail)
        if (mailbox === 'inbox' && !detail.is_read) {
          await mailApi.markRead(messageId)
          onRead?.()
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
      setData(null)
    }
  }, [open, messageId, mailbox, onRead])

  const attachments = data?.attachments || []

  return (
    <Drawer title={data ? data.subject || '(无主题)' : '查看邮件'} open={open} width={720} onClose={onClose} destroyOnClose>
      <Spin spinning={loading && !data}>
        {data && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Typography.Text type="secondary">发件人：</Typography.Text>
              <Typography.Text>{data.sender_name || `用户${data.sender_id}`}</Typography.Text>
            </div>
            <div>
              <Typography.Text type="secondary">收件人：</Typography.Text>
              <Space wrap>
                {data.recipients.length
                  ? data.recipients.map(item => (
                      <Tag key={item.id} color={item.status === 'recalled' ? 'default' : 'blue'}>
                        {item.name || `用户${item.id}`}
                        {item.status === 'recalled' ? '（已撤回）' : ''}
                      </Tag>
                    ))
                  : '-'}
              </Space>
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <div
              style={{ minHeight: 200 }}
              className="mail-content"
              dangerouslySetInnerHTML={{ __html: data.content || '<p>(空正文)</p>' }}
            />
            {attachments.length > 0 && (
              <>
                <Divider />
                <Typography.Text strong>附件</Typography.Text>
                <List
                  dataSource={attachments}
                  renderItem={item => (
                    <List.Item>
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.file_name}（{(item.file_size / 1024).toFixed(1)}KB）
                      </a>
                    </List.Item>
                  )}
                />
              </>
            )}
          </Space>
        )}
      </Spin>
    </Drawer>
  )
}
