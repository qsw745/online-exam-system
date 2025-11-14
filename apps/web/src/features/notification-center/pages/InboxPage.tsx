import { Badge, Card, List, Modal, Space, Tag, Typography } from 'antd'
import React, { useMemo, useState } from 'react'
import './inbox-page.css'

const { Paragraph, Text } = Typography

type Item = {
  id: number
  title: string
  type: 'notice' | 'message'
  read?: boolean
  created_at: string
  content: string
}

export default function InboxPage() {
  const [list] = useState<Item[]>(
    useMemo(
      () => [
        {
          id: 1,
          title: '系统维护公告',
          type: 'notice',
          created_at: '2025-01-05 08:00',
          content: '系统将在 01-05 08:30 至 09:00 期间进行例行维护，期间可能无法正常访问。',
        },
        {
          id: 2,
          title: '考试开始提醒',
          type: 'message',
          created_at: '2025-01-05 09:00',
          content: '您报名的《综合素质测试》将于 09:30 开始，请提前 15 分钟登录系统检查设备。',
        },
      ],
      []
    )
  )
  const [active, setActive] = useState<Item | null>(null)

  const unread = list.filter(i => !i.read).length

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Badge count={unread} offset={[-6, 12]} className="inbox-badge">
        <Card title="收件箱" className="inbox-card">
          <List
            dataSource={list}
            renderItem={it => (
              <List.Item className="inbox-list-item" onClick={() => setActive(it)}>
                <Space size={12} wrap>
                  <Tag color={it.type === 'notice' ? 'blue' : 'green'}>{it.type === 'notice' ? '公告' : '消息'}</Tag>
                  <span className="inbox-title">{it.title}</span>
                  <span className="inbox-time">{it.created_at}</span>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      </Badge>

      <Modal
        open={!!active}
        title={active?.title}
        onCancel={() => setActive(null)}
        footer={null}
        centered
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text type="secondary">{active?.created_at}</Text>
          <Paragraph>{active?.content}</Paragraph>
        </Space>
      </Modal>
    </Space>
  )
}
