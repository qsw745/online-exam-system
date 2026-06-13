import { Badge, Card, List, Modal, Space, Tag, Typography } from 'antd'
import React, { useEffect, useState } from 'react'
import dayjs from '@/shared/utils/dayjs'
import './inbox-page.css'
import { notificationsApi, type NotificationAttachment, type NotificationDTO } from '@/shared/api/endpoints/notifications'

const { Paragraph, Text } = Typography

export default function InboxPage() {
  const [list, setList] = useState<NotificationDTO[]>([])
  const [active, setActive] = useState<NotificationDTO | null>(null)

  const load = async () => {
    try {
      const items = await notificationsApi.list()
      setList(items)
    } catch {
      setList([])
    }
  }

  useEffect(() => {
    load()
  }, [])

  const unread = list.filter(i => !i.is_read).length

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Badge count={unread} offset={[-6, 12]} className="inbox-badge">
        <Card title="收件箱" className="inbox-card">
          <List
            dataSource={list}
            renderItem={it => (
              <List.Item
                className="inbox-list-item"
                onClick={async () => {
                  setActive(it)
                  if (!it.is_read) {
                    await notificationsApi.markRead(it.id)
                    load()
                  }
                }}
              >
                <Space size={12} wrap>
                  <Tag color={it.type === 'announcement' ? 'blue' : 'green'}>
                    {it.type === 'announcement' ? '公告' : '消息'}
                  </Tag>
                  <span className="inbox-title">{it.title}</span>
                  <span className="inbox-time">
                    {it.created_at ? dayjs(it.created_at).format('YYYY-MM-DD HH:mm') : ''}
                  </span>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      </Badge>

      <Modal open={!!active} title={active?.title} onCancel={() => setActive(null)} footer={null} centered>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text type="secondary">
            {active?.created_at ? dayjs(active.created_at).format('YYYY-MM-DD HH:mm') : ''}
          </Text>
          <Paragraph>{active?.content}</Paragraph>
          {active?.attachments && active.attachments.length > 0 && (
            <div>
              <Text strong>附件：</Text>
              <ul style={{ paddingLeft: 16 }}>
                {active.attachments.map((att: NotificationAttachment) => (
                  <li key={att.id}>
                    <a href={att.url} target="_blank" rel="noreferrer">
                      {att.file_name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Space>
      </Modal>
    </Space>
  )
}
